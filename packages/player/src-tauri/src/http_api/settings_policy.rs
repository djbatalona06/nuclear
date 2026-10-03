const REMOTE_READABLE_SETTINGS: [&str; 6] = [
    "core.playback.shuffle",
    "core.playback.repeat",
    "core.playback.discovery",
    "core.general.language",
    "core.theme.dark",
    "core.theme.active.id",
];
const REMOTE_WRITABLE_SETTINGS_PREFIX: &str = "core.playback.";

pub fn is_remote_writable(id: &str) -> bool {
    id.starts_with(REMOTE_WRITABLE_SETTINGS_PREFIX)
}

pub fn is_remote_readable(id: &str) -> bool {
    REMOTE_READABLE_SETTINGS.contains(&id) || is_remote_writable(id)
}

#[cfg(test)]
#[path = "settings_policy.test.rs"]
mod tests;
