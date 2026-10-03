use super::{is_remote_readable, is_remote_writable};

#[test]
fn playback_settings_are_readable_and_writable() {
    assert!(is_remote_readable("core.playback.shuffle"));
    assert!(is_remote_writable("core.playback.shuffle"));
}

#[test]
fn display_settings_are_readable_but_not_writable() {
    assert!(is_remote_readable("core.general.language"));
    assert!(is_remote_readable("core.theme.dark"));
    assert!(!is_remote_writable("core.theme.dark"));
}

#[test]
fn integration_and_credential_settings_are_not_exposed() {
    assert!(!is_remote_readable("core.integrations.jam.publicUrl"));
    assert!(!is_remote_readable("core.integrations.mcp.enabled"));
    assert!(!is_remote_readable("core.integrations.jam.localOnly"));
    assert!(!is_remote_readable("core.integrations.lastfm.apiKey"));
    assert!(!is_remote_writable("core.integrations.jam.localOnly"));
}

#[test]
fn lookalike_ids_do_not_slip_through() {
    assert!(!is_remote_readable("core.playbackx.shuffle"));
    assert!(!is_remote_readable(""));
    assert!(!is_remote_readable("../core.playback.shuffle"));
    assert!(!is_remote_writable("x.core.playback.shuffle"));
}
