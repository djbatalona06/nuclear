use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    extract::{Request, State},
    http::{
        header::{COOKIE, SET_COOKIE, USER_AGENT},
        HeaderMap, Method, StatusCode,
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Extension, Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use percent_encoding::percent_decode_str;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use tokio::sync::Mutex;

use super::devices::{DeviceStore, RemoteDevice};
use super::settings_policy;

pub const DEVICE_COOKIE: &str = "nuclear_device";
pub const CLIENT_HEADER: &str = "x-nuclear-client";
pub const CLIENT_HEADER_VALUE: &str = "remote";
const FORWARDED_PROTO_HEADER: &str = "x-forwarded-proto";

const PAIRING_CODE_LENGTH: usize = 8;
const PAIRING_CODE_ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_CODE_TTL: Duration = Duration::from_secs(5 * 60);
const MAX_PAIRING_ATTEMPTS: u8 = 5;
const TOKEN_BYTES: usize = 32;
const COOKIE_MAX_AGE_SECONDS: u64 = 60 * 60 * 24 * 365;
const MAX_DEVICE_NAME_LENGTH: usize = 64;
const API_PREFIX: &str = "/api/";
const PUBLIC_API_PATHS: [&str; 2] = ["/api/health", "/api/pair"];
const SETTINGS_PATH_PREFIX: &str = "/api/settings/";

struct PendingPairing {
    code: String,
    expires_at: Instant,
    failed_attempts: u8,
}

#[derive(Debug, PartialEq)]
pub enum PairingError {
    InvalidCode,
    TooManyAttempts,
}

#[derive(Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PairingCode {
    pub code: String,
    pub expires_in_seconds: u32,
}

#[derive(Clone)]
pub struct AuthState {
    pub devices: DeviceStore,
    pending: Arc<Mutex<Option<PendingPairing>>>,
    pairing_ttl: Duration,
}

impl AuthState {
    pub fn new(devices: DeviceStore) -> Self {
        Self::with_pairing_ttl(devices, PAIRING_CODE_TTL)
    }

    pub fn with_pairing_ttl(devices: DeviceStore, pairing_ttl: Duration) -> Self {
        Self {
            devices,
            pending: Arc::new(Mutex::new(None)),
            pairing_ttl,
        }
    }

    pub async fn start_pairing(&self) -> PairingCode {
        let code = generate_pairing_code();
        *self.pending.lock().await = Some(PendingPairing {
            code: code.clone(),
            expires_at: Instant::now() + self.pairing_ttl,
            failed_attempts: 0,
        });
        PairingCode {
            code,
            expires_in_seconds: self.pairing_ttl.as_secs() as u32,
        }
    }

    pub async fn redeem(&self, submitted: &str) -> Result<(), PairingError> {
        let mut pending = self.pending.lock().await;
        let Some(pairing) = pending.as_mut() else {
            return Err(PairingError::InvalidCode);
        };

        if Instant::now() >= pairing.expires_at {
            *pending = None;
            return Err(PairingError::InvalidCode);
        }

        if normalize_code(submitted) == pairing.code {
            *pending = None;
            return Ok(());
        }

        pairing.failed_attempts += 1;
        if pairing.failed_attempts >= MAX_PAIRING_ATTEMPTS {
            *pending = None;
            return Err(PairingError::TooManyAttempts);
        }
        Err(PairingError::InvalidCode)
    }
}

pub fn hash_token(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

fn random_bytes<const LENGTH: usize>() -> [u8; LENGTH] {
    let mut bytes = [0u8; LENGTH];
    getrandom::fill(&mut bytes).expect("operating system random source is unavailable");
    bytes
}

fn generate_token() -> String {
    URL_SAFE_NO_PAD.encode(random_bytes::<TOKEN_BYTES>())
}

fn generate_pairing_code() -> String {
    random_bytes::<PAIRING_CODE_LENGTH>()
        .iter()
        .map(|byte| PAIRING_CODE_ALPHABET[*byte as usize % PAIRING_CODE_ALPHABET.len()] as char)
        .collect()
}

fn normalize_code(code: &str) -> String {
    code.chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .map(|character| character.to_ascii_uppercase())
        .collect()
}

fn now_seconds() -> i64 {
    chrono::Utc::now().timestamp()
}

fn secure_attribute(secure: bool) -> &'static str {
    if secure {
        "; Secure"
    } else {
        ""
    }
}

fn is_secure_request(headers: &HeaderMap) -> bool {
    headers
        .get(FORWARDED_PROTO_HEADER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .is_some_and(|protocol| protocol.trim().eq_ignore_ascii_case("https"))
}

fn device_cookie(token: &str, secure: bool) -> String {
    let secure = secure_attribute(secure);
    format!("{DEVICE_COOKIE}={token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age={COOKIE_MAX_AGE_SECONDS}{secure}")
}

fn expired_device_cookie(secure: bool) -> String {
    let secure = secure_attribute(secure);
    format!("{DEVICE_COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0{secure}")
}

fn device_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| *name == DEVICE_COOKIE)
        .map(|(_, value)| value.to_string())
        .filter(|value| !value.is_empty())
}

fn has_client_header(headers: &HeaderMap) -> bool {
    headers
        .get(CLIENT_HEADER)
        .is_some_and(|value| value == CLIENT_HEADER_VALUE)
}

fn is_mutation(method: &Method) -> bool {
    !matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS)
}

fn error_response(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

async fn guard(State(auth): State<AuthState>, mut request: Request, next: Next) -> Response {
    let path = request.uri().path().to_string();
    if !path.starts_with(API_PREFIX) {
        return next.run(request).await;
    }

    if is_mutation(request.method()) && !has_client_header(request.headers()) {
        return error_response(StatusCode::FORBIDDEN, "missing_client_header");
    }

    if PUBLIC_API_PATHS.contains(&path.as_str()) {
        return next.run(request).await;
    }

    let Some(token) = device_token(request.headers()) else {
        return error_response(StatusCode::UNAUTHORIZED, "unauthorized");
    };

    let device = match auth
        .devices
        .find_active_by_token_hash(&hash_token(&token))
        .await
    {
        Ok(Some(device)) => device,
        Ok(None) => return error_response(StatusCode::UNAUTHORIZED, "unauthorized"),
        Err(err) => {
            log::error!("{err}");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "device_lookup_failed");
        }
    };

    if let Some(encoded_setting_id) = path.strip_prefix(SETTINGS_PATH_PREFIX) {
        let setting_id = percent_decode_str(encoded_setting_id).decode_utf8_lossy();
        if is_mutation(request.method()) {
            if !settings_policy::is_remote_writable(&setting_id) {
                return error_response(StatusCode::FORBIDDEN, "setting_not_writable");
            }
        } else if !settings_policy::is_remote_readable(&setting_id) {
            return error_response(StatusCode::FORBIDDEN, "setting_not_readable");
        }
    }

    if let Err(err) = auth.devices.touch(&device.id, now_seconds()).await {
        log::warn!("{err}");
    }

    request.extensions_mut().insert(device);
    next.run(request).await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairRequest {
    code: String,
    device_name: String,
}

async fn pair(
    State(auth): State<AuthState>,
    headers: HeaderMap,
    Json(body): Json<PairRequest>,
) -> Response {
    let device_name = body.device_name.trim();
    if device_name.is_empty() || device_name.chars().count() > MAX_DEVICE_NAME_LENGTH {
        return error_response(StatusCode::BAD_REQUEST, "invalid_device_name");
    }

    match auth.redeem(&body.code).await {
        Ok(()) => {}
        Err(PairingError::InvalidCode) => {
            return error_response(StatusCode::UNAUTHORIZED, "invalid_code")
        }
        Err(PairingError::TooManyAttempts) => {
            return error_response(StatusCode::TOO_MANY_REQUESTS, "too_many_attempts")
        }
    }

    let token = generate_token();
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok());
    match auth
        .devices
        .register(device_name, user_agent, &hash_token(&token), now_seconds())
        .await
    {
        Ok(device) => (
            StatusCode::OK,
            [(
                SET_COOKIE,
                device_cookie(&token, is_secure_request(&headers)),
            )],
            Json(json!({ "deviceId": device.id, "name": device.name })),
        )
            .into_response(),
        Err(err) => {
            log::error!("{err}");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "pairing_failed")
        }
    }
}

async fn me(Extension(device): Extension<RemoteDevice>) -> Response {
    Json(json!({ "deviceId": device.id, "name": device.name })).into_response()
}

async fn unpair(
    State(auth): State<AuthState>,
    Extension(device): Extension<RemoteDevice>,
    headers: HeaderMap,
) -> Response {
    match auth.devices.revoke(&device.id, now_seconds()).await {
        Ok(()) => (
            StatusCode::NO_CONTENT,
            [(
                SET_COOKIE,
                expired_device_cookie(is_secure_request(&headers)),
            )],
        )
            .into_response(),
        Err(err) => {
            log::error!("{err}");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "unpair_failed")
        }
    }
}

pub fn protect(router: Router, auth: AuthState) -> Router {
    let auth_routes = Router::new()
        .route("/api/pair", post(pair))
        .route("/api/me", get(me).delete(unpair))
        .with_state(auth.clone());

    router
        .merge(auth_routes)
        .layer(middleware::from_fn_with_state(auth, guard))
}

#[cfg(test)]
#[path = "auth.test.rs"]
mod tests;
