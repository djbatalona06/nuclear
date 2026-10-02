use std::time::Duration;

use axum::{
    body::{to_bytes, Body},
    http::{header, Request, StatusCode},
    response::Response,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use tower::ServiceExt;

use super::{hash_token, protect, AuthState, CLIENT_HEADER, CLIENT_HEADER_VALUE, DEVICE_COOKIE};
use crate::http_api::devices::fixtures;

const MAX_BODY_BYTES: usize = 64 * 1024;

async fn auth_state() -> AuthState {
    AuthState::new(fixtures::store().await)
}

fn app(auth: &AuthState) -> Router {
    let routes = Router::new()
        .route("/api/health", get(|| async { "ok" }))
        .route("/api/queue", get(|| async { "queue" }))
        .route("/api/playback/toggle", post(|| async { "toggled" }))
        .route("/api/settings/{id}", post(|| async { "saved" }))
        .fallback(|| async { "frontend" });
    protect(routes, auth.clone())
}

async fn send(app: &Router, request: Request<Body>) -> Response {
    app.clone().oneshot(request).await.unwrap()
}

fn get_request(path: &str, cookie: Option<&str>) -> Request<Body> {
    let mut builder = Request::get(path);
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    builder.body(Body::empty()).unwrap()
}

fn post_request(path: &str, cookie: Option<&str>, body: Value) -> Request<Body> {
    let mut builder = Request::post(path)
        .header(header::CONTENT_TYPE, "application/json")
        .header(CLIENT_HEADER, CLIENT_HEADER_VALUE);
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    builder.body(Body::from(body.to_string())).unwrap()
}

fn pair_request(code: &str) -> Request<Body> {
    post_request(
        "/api/pair",
        None,
        json!({ "code": code, "deviceName": "Kitchen iPad" }),
    )
}

fn session_cookie(response: &Response) -> String {
    response
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_string()
}

async fn json_body(response: Response) -> Value {
    let bytes = to_bytes(response.into_body(), MAX_BODY_BYTES)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap()
}

async fn paired_cookie(auth: &AuthState, app: &Router) -> String {
    let pairing = auth.start_pairing().await;
    let response = send(app, pair_request(&pairing.code)).await;
    assert_eq!(response.status(), StatusCode::OK);
    session_cookie(&response)
}

#[tokio::test]
async fn health_and_frontend_are_public() {
    let auth = auth_state().await;
    let app = app(&auth);

    assert_eq!(
        send(&app, get_request("/api/health", None)).await.status(),
        StatusCode::OK
    );
    assert_eq!(
        send(&app, get_request("/", None)).await.status(),
        StatusCode::OK
    );
    assert_eq!(
        send(&app, get_request("/pair", None)).await.status(),
        StatusCode::OK
    );
}

#[tokio::test]
async fn api_requires_a_paired_device() {
    let auth = auth_state().await;
    let app = app(&auth);

    let response = send(&app, get_request("/api/queue", None)).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        json_body(response).await,
        json!({ "error": "unauthorized" })
    );
}

#[tokio::test]
async fn unknown_cookie_is_rejected() {
    let auth = auth_state().await;
    let app = app(&auth);

    let cookie = format!("{DEVICE_COOKIE}=forged");
    let response = send(&app, get_request("/api/queue", Some(&cookie))).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn pairing_sets_a_cookie_that_unlocks_the_api() {
    let auth = auth_state().await;
    let app = app(&auth);

    let cookie = paired_cookie(&auth, &app).await;
    let response = send(&app, get_request("/api/queue", Some(&cookie))).await;

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn pairing_cookie_is_http_only_and_strict() {
    let auth = auth_state().await;
    let app = app(&auth);
    let pairing = auth.start_pairing().await;

    let response = send(&app, pair_request(&pairing.code)).await;
    let set_cookie = response
        .headers()
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap();

    assert!(set_cookie.contains("HttpOnly"));
    assert!(set_cookie.contains("SameSite=Strict"));
    assert!(set_cookie.contains("Path=/api"));
}

#[tokio::test]
async fn only_the_token_hash_is_stored() {
    let auth = auth_state().await;
    let app = app(&auth);

    let cookie = paired_cookie(&auth, &app).await;
    let token = cookie.split_once('=').unwrap().1;

    let by_hash = auth
        .devices
        .find_active_by_token_hash(&hash_token(token))
        .await
        .unwrap();
    let by_raw = auth
        .devices
        .find_active_by_token_hash(token.as_bytes())
        .await
        .unwrap();

    assert!(by_hash.is_some());
    assert!(by_raw.is_none());
}

#[tokio::test]
async fn pairing_codes_work_once() {
    let auth = auth_state().await;
    let app = app(&auth);
    let pairing = auth.start_pairing().await;

    let first = send(&app, pair_request(&pairing.code)).await;
    let second = send(&app, pair_request(&pairing.code)).await;

    assert_eq!(first.status(), StatusCode::OK);
    assert_eq!(second.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn pairing_codes_ignore_case_spaces_and_dashes() {
    let auth = auth_state().await;
    let app = app(&auth);
    let pairing = auth.start_pairing().await;
    let typed = format!(
        "{}-{}",
        pairing.code[..4].to_lowercase(),
        &pairing.code[4..]
    );

    let response = send(&app, pair_request(&format!(" {typed} "))).await;

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn pairing_fails_without_an_active_code() {
    let auth = auth_state().await;
    let app = app(&auth);

    let response = send(&app, pair_request("ABCDEFGH")).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn expired_codes_are_rejected() {
    let auth = AuthState::with_pairing_ttl(fixtures::store().await, Duration::ZERO);
    let app = app(&auth);
    let pairing = auth.start_pairing().await;

    let response = send(&app, pair_request(&pairing.code)).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn too_many_wrong_codes_burn_the_active_code() {
    let auth = auth_state().await;
    let app = app(&auth);
    let pairing = auth.start_pairing().await;

    let mut statuses = Vec::new();
    for _ in 0..5 {
        statuses.push(send(&app, pair_request("WRONGCDE")).await.status());
    }
    let with_real_code = send(&app, pair_request(&pairing.code)).await;

    assert_eq!(statuses[..4], [StatusCode::UNAUTHORIZED; 4]);
    assert_eq!(statuses[4], StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(with_real_code.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn pairing_requires_a_device_name() {
    let auth = auth_state().await;
    let app = app(&auth);
    let pairing = auth.start_pairing().await;

    let response = send(
        &app,
        post_request(
            "/api/pair",
            None,
            json!({ "code": pairing.code, "deviceName": "  " }),
        ),
    )
    .await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn mutations_require_the_client_header() {
    let auth = auth_state().await;
    let app = app(&auth);
    let cookie = paired_cookie(&auth, &app).await;

    let request = Request::post("/api/playback/toggle")
        .header(header::COOKIE, &cookie)
        .body(Body::empty())
        .unwrap();
    let response = send(&app, request).await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn mutations_with_the_client_header_go_through() {
    let auth = auth_state().await;
    let app = app(&auth);
    let cookie = paired_cookie(&auth, &app).await;

    let response = send(
        &app,
        post_request("/api/playback/toggle", Some(&cookie), json!({})),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn paired_devices_can_only_write_playback_settings() {
    let auth = auth_state().await;
    let app = app(&auth);
    let cookie = paired_cookie(&auth, &app).await;

    let playback = send(
        &app,
        post_request(
            "/api/settings/core.playback.discovery",
            Some(&cookie),
            json!(true),
        ),
    )
    .await;
    let other = send(
        &app,
        post_request(
            "/api/settings/core.integrations.jam.enabled",
            Some(&cookie),
            json!(false),
        ),
    )
    .await;

    assert_eq!(playback.status(), StatusCode::OK);
    assert_eq!(other.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn revoked_devices_lose_access() {
    let auth = auth_state().await;
    let app = app(&auth);
    let cookie = paired_cookie(&auth, &app).await;
    let device = auth.devices.list_active().await.unwrap().remove(0);

    auth.devices.revoke(&device.id, 0).await.unwrap();
    let response = send(&app, get_request("/api/queue", Some(&cookie))).await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_describes_the_calling_device() {
    let auth = auth_state().await;
    let app = app(&auth);
    let cookie = paired_cookie(&auth, &app).await;
    let device = auth.devices.list_active().await.unwrap().remove(0);

    let response = send(&app, get_request("/api/me", Some(&cookie))).await;

    assert_eq!(
        json_body(response).await,
        json!({ "deviceId": device.id, "name": "Kitchen iPad" })
    );
}

#[tokio::test]
async fn unpairing_revokes_the_calling_device() {
    let auth = auth_state().await;
    let app = app(&auth);
    let cookie = paired_cookie(&auth, &app).await;

    let request = Request::delete("/api/me")
        .header(header::COOKIE, &cookie)
        .header(CLIENT_HEADER, CLIENT_HEADER_VALUE)
        .body(Body::empty())
        .unwrap();
    let unpaired = send(&app, request).await;
    let afterwards = send(&app, get_request("/api/queue", Some(&cookie))).await;

    assert_eq!(unpaired.status(), StatusCode::NO_CONTENT);
    assert_eq!(afterwards.status(), StatusCode::UNAUTHORIZED);
    assert!(auth.devices.list_active().await.unwrap().is_empty());
}

#[tokio::test]
async fn path_tricks_never_reach_protected_routes_without_a_device() {
    let auth = auth_state().await;
    let app = app(&auth);

    for path in [
        "//api/queue",
        "/api/./queue",
        "/x/../api/queue",
        "/API/queue",
    ] {
        let response = send(&app, get_request(path, None)).await;
        let bytes = to_bytes(response.into_body(), MAX_BODY_BYTES)
            .await
            .unwrap();
        assert_ne!(&bytes[..], b"queue", "{path} reached a protected route");
    }
}

#[tokio::test]
async fn encoded_setting_ids_cannot_escape_the_playback_allowlist() {
    let auth = auth_state().await;
    let app = app(&auth);
    let cookie = paired_cookie(&auth, &app).await;

    let response = send(
        &app,
        post_request(
            "/api/settings/core%2Eintegrations.jam.enabled",
            Some(&cookie),
            json!(false),
        ),
    )
    .await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
