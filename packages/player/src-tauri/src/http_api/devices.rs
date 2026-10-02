use serde::Serialize;
use specta_typescript::Number;
use sqlx::sqlite::SqlitePool;
use uuid::Uuid;

const LAST_SEEN_RESOLUTION_SECONDS: i64 = 60;

#[derive(Clone, Debug, PartialEq, Serialize, sqlx::FromRow, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDevice {
    pub id: String,
    pub name: String,
    #[specta(type = Number<i64>)]
    pub created_at: i64,
    #[specta(type = Option<Number<i64>>)]
    pub last_seen_at: Option<i64>,
}

#[derive(Clone)]
pub struct DeviceStore(SqlitePool);

impl DeviceStore {
    pub fn new(pool: SqlitePool) -> Self {
        Self(pool)
    }

    pub async fn register(
        &self,
        name: &str,
        user_agent: Option<&str>,
        token_hash: &[u8],
        now: i64,
    ) -> Result<RemoteDevice, String> {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO remote_devices (id, name, token_hash, user_agent, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(name)
        .bind(token_hash)
        .bind(user_agent)
        .bind(now)
        .execute(&self.0)
        .await
        .map_err(|err| format!("Failed to register remote device: {err}"))?;

        Ok(RemoteDevice {
            id,
            name: name.to_string(),
            created_at: now,
            last_seen_at: None,
        })
    }

    pub async fn find_active_by_token_hash(
        &self,
        token_hash: &[u8],
    ) -> Result<Option<RemoteDevice>, String> {
        sqlx::query_as::<_, RemoteDevice>(
            "SELECT id, name, created_at, last_seen_at FROM remote_devices WHERE token_hash = ? AND revoked_at IS NULL",
        )
        .bind(token_hash)
        .fetch_optional(&self.0)
        .await
        .map_err(|err| format!("Failed to look up remote device: {err}"))
    }

    pub async fn list_active(&self) -> Result<Vec<RemoteDevice>, String> {
        sqlx::query_as::<_, RemoteDevice>(
            "SELECT id, name, created_at, last_seen_at FROM remote_devices WHERE revoked_at IS NULL ORDER BY created_at DESC, id",
        )
        .fetch_all(&self.0)
        .await
        .map_err(|err| format!("Failed to list remote devices: {err}"))
    }

    pub async fn revoke(&self, id: &str, now: i64) -> Result<(), String> {
        sqlx::query("UPDATE remote_devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
            .bind(now)
            .bind(id)
            .execute(&self.0)
            .await
            .map(|_| ())
            .map_err(|err| format!("Failed to revoke remote device: {err}"))
    }

    pub async fn touch(&self, id: &str, now: i64) -> Result<(), String> {
        sqlx::query(
            "UPDATE remote_devices SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at <= ?)",
        )
        .bind(now)
        .bind(id)
        .bind(now - LAST_SEEN_RESOLUTION_SECONDS)
        .execute(&self.0)
        .await
        .map(|_| ())
        .map_err(|err| format!("Failed to update remote device last seen: {err}"))
    }
}

#[cfg(test)]
pub mod fixtures {
    use std::sync::atomic::{AtomicU32, Ordering};

    use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};

    use super::DeviceStore;

    static DB_COUNTER: AtomicU32 = AtomicU32::new(0);

    pub async fn store() -> DeviceStore {
        let id = DB_COUNTER.fetch_add(1, Ordering::Relaxed);
        let options: SqliteConnectOptions =
            format!("sqlite:file:remote_testdb_{id}?mode=memory&cache=shared")
                .parse()
                .unwrap();
        let pool = SqlitePool::connect_with(crate::db::configure(options))
            .await
            .unwrap();
        sqlx::migrate!("./migrations/remote")
            .run(&pool)
            .await
            .unwrap();
        DeviceStore::new(pool)
    }
}

#[cfg(test)]
#[path = "devices.test.rs"]
mod tests;
