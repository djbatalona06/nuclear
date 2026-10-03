use axum::{
    body::Body,
    http::{header, Request, StatusCode},
    middleware,
    response::Response,
    routing::get,
    Router,
};
use tower::ServiceExt;

use super::security_headers;

fn app() -> Router {
    Router::new()
        .route("/api/queue", get(|| async { "queue" }))
        .route(
            "/api/missing-auth",
            get(|| async { (StatusCode::UNAUTHORIZED, "no") }),
        )
        .fallback(|| async { "frontend" })
        .layer(middleware::from_fn(security_headers))
}

async fn fetch(path: &str) -> Response {
    app()
        .oneshot(Request::get(path).body(Body::empty()).unwrap())
        .await
        .unwrap()
}

fn header_value<'response>(response: &'response Response, name: &str) -> &'response str {
    response.headers().get(name).unwrap().to_str().unwrap()
}

#[tokio::test]
async fn every_response_forbids_sniffing_framing_and_referrers() {
    let response = fetch("/").await;

    assert_eq!(header_value(&response, "x-content-type-options"), "nosniff");
    assert_eq!(header_value(&response, "x-frame-options"), "DENY");
    assert_eq!(header_value(&response, "referrer-policy"), "no-referrer");
    assert_eq!(
        header_value(&response, "cross-origin-resource-policy"),
        "same-origin"
    );
    assert!(header_value(&response, "content-security-policy").contains("frame-ancestors 'none'"));
}

#[tokio::test]
async fn api_responses_are_never_cached() {
    assert_eq!(
        header_value(&fetch("/api/queue").await, header::CACHE_CONTROL.as_str()),
        "no-store"
    );
}

#[tokio::test]
async fn rejected_api_responses_are_never_cached_either() {
    let response = fetch("/api/missing-auth").await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        header_value(&response, header::CACHE_CONTROL.as_str()),
        "no-store"
    );
}

#[tokio::test]
async fn frontend_assets_stay_cacheable_for_the_service_worker() {
    assert!(fetch("/")
        .await
        .headers()
        .get(header::CACHE_CONTROL)
        .is_none());
}
