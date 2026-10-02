use super::fixtures;

const NOW: i64 = 1_700_000_000;

#[tokio::test]
async fn finds_a_registered_device_by_its_token_hash() {
    let store = fixtures::store().await;
    let device = store
        .register("Kitchen iPad", Some("Safari"), b"hash-1", NOW)
        .await
        .unwrap();

    let found = store.find_active_by_token_hash(b"hash-1").await.unwrap();

    assert_eq!(found, Some(device));
}

#[tokio::test]
async fn does_not_find_an_unknown_token_hash() {
    let store = fixtures::store().await;
    store.register("Phone", None, b"hash-1", NOW).await.unwrap();

    let found = store.find_active_by_token_hash(b"other").await.unwrap();

    assert_eq!(found, None);
}

#[tokio::test]
async fn revoked_devices_are_not_found_or_listed() {
    let store = fixtures::store().await;
    let kept = store.register("Phone", None, b"hash-1", NOW).await.unwrap();
    let revoked = store
        .register("Tablet", None, b"hash-2", NOW)
        .await
        .unwrap();

    store.revoke(&revoked.id, NOW + 1).await.unwrap();

    assert_eq!(
        store.find_active_by_token_hash(b"hash-2").await.unwrap(),
        None
    );
    assert_eq!(store.list_active().await.unwrap(), vec![kept]);
}

#[tokio::test]
async fn lists_newest_devices_first() {
    let store = fixtures::store().await;
    store.register("Older", None, b"hash-1", NOW).await.unwrap();
    store
        .register("Newer", None, b"hash-2", NOW + 10)
        .await
        .unwrap();

    let names: Vec<String> = store
        .list_active()
        .await
        .unwrap()
        .into_iter()
        .map(|device| device.name)
        .collect();

    assert_eq!(names, vec!["Newer", "Older"]);
}

#[tokio::test]
async fn touch_records_last_seen_at_most_once_a_minute() {
    let store = fixtures::store().await;
    let device = store.register("Phone", None, b"hash-1", NOW).await.unwrap();

    store.touch(&device.id, NOW + 5).await.unwrap();
    store.touch(&device.id, NOW + 30).await.unwrap();
    let after_quick_touches = store.find_active_by_token_hash(b"hash-1").await.unwrap();

    store.touch(&device.id, NOW + 70).await.unwrap();
    let after_a_minute = store.find_active_by_token_hash(b"hash-1").await.unwrap();

    assert_eq!(after_quick_touches.unwrap().last_seen_at, Some(NOW + 5));
    assert_eq!(after_a_minute.unwrap().last_seen_at, Some(NOW + 70));
}
