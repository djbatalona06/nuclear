use axum::{
    extract::{Request, State},
    http::{
        header::{HOST, ORIGIN},
        StatusCode,
    },
    middleware::Next,
    response::{IntoResponse, Response},
};

const LOOPBACK_HOSTS: [&str; 3] = ["127.0.0.1", "localhost", "[::1]"];

pub const TAURI_ORIGINS: &[&str] = &[
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
];

pub const NO_EXTRA_ORIGINS: &[&str] = &[];

fn split_host(authority: &str) -> Option<&str> {
    let (host, remainder) = if authority.starts_with('[') {
        let end = authority.find(']')?;
        (&authority[..=end], &authority[end + 1..])
    } else {
        match authority.find(':') {
            Some(index) => (&authority[..index], &authority[index..]),
            None => (authority, ""),
        }
    };

    let valid_port = remainder.is_empty()
        || remainder
            .strip_prefix(':')
            .is_some_and(|port| !port.is_empty() && port.bytes().all(|byte| byte.is_ascii_digit()));

    valid_port.then_some(host)
}

pub fn is_loopback_authority(authority: &str) -> bool {
    split_host(authority).is_some_and(|host| {
        LOOPBACK_HOSTS
            .iter()
            .any(|allowed| host.eq_ignore_ascii_case(allowed))
    })
}

pub fn is_allowed_origin(origin: &str, extra_origins: &[&str]) -> bool {
    if extra_origins.contains(&origin) {
        return true;
    }
    origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
        .is_some_and(is_loopback_authority)
}

fn request_authority(request: &Request) -> Option<String> {
    request
        .headers()
        .get(HOST)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
        .or_else(|| {
            request
                .uri()
                .authority()
                .map(|authority| authority.to_string())
        })
}

pub async fn require_local_origin(
    State(extra_origins): State<&'static [&'static str]>,
    request: Request,
    next: Next,
) -> Response {
    let host_is_loopback =
        request_authority(&request).is_some_and(|authority| is_loopback_authority(&authority));
    if !host_is_loopback {
        return (StatusCode::FORBIDDEN, "forbidden_host").into_response();
    }

    if let Some(origin) = request.headers().get(ORIGIN) {
        let origin_allowed = origin
            .to_str()
            .ok()
            .is_some_and(|origin| is_allowed_origin(origin, extra_origins));
        if !origin_allowed {
            return (StatusCode::FORBIDDEN, "forbidden_origin").into_response();
        }
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{header, Request, StatusCode},
        middleware,
        routing::get,
        Router,
    };
    use tower::ServiceExt;

    use super::{
        is_allowed_origin, is_loopback_authority, require_local_origin, NO_EXTRA_ORIGINS,
        TAURI_ORIGINS,
    };

    fn app(extra_origins: &'static [&'static str]) -> Router {
        Router::new()
            .route("/", get(|| async { "ok" }))
            .layer(middleware::from_fn_with_state(
                extra_origins,
                require_local_origin,
            ))
    }

    async fn status(app: &Router, host: &str, origin: Option<&str>) -> StatusCode {
        let mut builder = Request::get("/").header(header::HOST, host);
        if let Some(origin) = origin {
            builder = builder.header(header::ORIGIN, origin);
        }
        app.clone()
            .oneshot(builder.body(Body::empty()).unwrap())
            .await
            .unwrap()
            .status()
    }

    #[test]
    fn loopback_authorities_are_recognised() {
        assert!(is_loopback_authority("127.0.0.1"));
        assert!(is_loopback_authority("127.0.0.1:8800"));
        assert!(is_loopback_authority("localhost:9100"));
        assert!(is_loopback_authority("LOCALHOST"));
        assert!(is_loopback_authority("[::1]:6600"));
    }

    #[test]
    fn non_loopback_authorities_are_rejected() {
        assert!(!is_loopback_authority("evil.com"));
        assert!(!is_loopback_authority("localhost.evil.com"));
        assert!(!is_loopback_authority("192.168.1.42:9100"));
        assert!(!is_loopback_authority("127.0.0.1:80@evil.com"));
        assert!(!is_loopback_authority("127.0.0.1:"));
        assert!(!is_loopback_authority("127.0.0.1:port"));
        assert!(!is_loopback_authority(""));
    }

    #[test]
    fn origins_are_limited_to_loopback_and_explicit_extras() {
        assert!(is_allowed_origin("http://localhost:5173", NO_EXTRA_ORIGINS));
        assert!(is_allowed_origin("tauri://localhost", TAURI_ORIGINS));
        assert!(!is_allowed_origin("tauri://localhost", NO_EXTRA_ORIGINS));
        assert!(!is_allowed_origin("https://evil.com", TAURI_ORIGINS));
        assert!(!is_allowed_origin("null", TAURI_ORIGINS));
        assert!(!is_allowed_origin(
            "http://localhost.evil.com",
            TAURI_ORIGINS
        ));
    }

    #[tokio::test]
    async fn requests_without_origin_from_a_loopback_host_pass() {
        let app = app(NO_EXTRA_ORIGINS);

        assert_eq!(status(&app, "127.0.0.1:8800", None).await, StatusCode::OK);
    }

    #[tokio::test]
    async fn rebound_hostnames_are_rejected() {
        let app = app(NO_EXTRA_ORIGINS);

        assert_eq!(
            status(&app, "attacker.example:8800", None).await,
            StatusCode::FORBIDDEN
        );
    }

    #[tokio::test]
    async fn cross_site_origins_are_rejected_even_on_a_loopback_host() {
        let app = app(TAURI_ORIGINS);

        assert_eq!(
            status(&app, "127.0.0.1:9100", Some("https://evil.com")).await,
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            status(&app, "127.0.0.1:9100", Some("tauri://localhost")).await,
            StatusCode::OK
        );
    }
}
