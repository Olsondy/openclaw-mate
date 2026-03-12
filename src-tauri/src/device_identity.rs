//! ed25519 设备身份管理模块
//!
//! - 首次调用时生成密钥对并持久化至 Tauri Store（config.json 中的 device_identity 键）
//! - deviceId 算法：SHA-256(ed25519 原始公钥 32 字节).hex()，与 openclaw 服务端一致
//! - 签名格式：base64url（与 openclaw 服务端 verifyDeviceSignature 兼容）

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// 设备身份（内存态）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceIdentity {
    /// SHA-256(public key bytes).hex()，与 openclaw 服务端算法一致
    pub device_id: String,
    /// ed25519 原始公钥的 base64url 编码（上报给 tenant）
    pub public_key_raw: String,
    /// ed25519 原始私钥的 base64url 编码（本地存储，永不传输）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key_raw: Option<String>,
}

/// Tauri Store 中持久化的结构
#[derive(Debug, Serialize, Deserialize)]
struct StoredIdentity {
    version: u8,
    device_id: String,
    public_key_raw: String,
    private_key_raw: String,
}

fn decode_key_32(raw: &str) -> Option<[u8; 32]> {
    let decoded = URL_SAFE_NO_PAD.decode(raw).ok()?;
    decoded.try_into().ok()
}

fn is_stored_identity_valid(stored: &StoredIdentity) -> bool {
    if stored.version != 1
        || stored.device_id.trim().is_empty()
        || stored.public_key_raw.trim().is_empty()
        || stored.private_key_raw.trim().is_empty()
    {
        return false;
    }

    let Some(public_key_bytes) = decode_key_32(&stored.public_key_raw) else {
        return false;
    };
    let Some(private_key_bytes) = decode_key_32(&stored.private_key_raw) else {
        return false;
    };

    let signing_key = SigningKey::from_bytes(&private_key_bytes);
    let verifying_key = signing_key.verifying_key();
    if verifying_key.to_bytes() != public_key_bytes {
        return false;
    }

    derive_device_id(&public_key_bytes) == stored.device_id
}

/// 从原始 32 字节公钥推导 deviceId（SHA-256 → hex）
pub fn derive_device_id(public_key_bytes: &[u8]) -> String {
    let hash = Sha256::digest(public_key_bytes);
    hex::encode(hash)
}

/// 生成新的 ed25519 密钥对
fn generate_keypair() -> (SigningKey, VerifyingKey) {
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    (signing_key, verifying_key)
}

/// 加载或新建设备身份，持久化至 Tauri Store
pub fn load_or_create_device_identity(app: &tauri::AppHandle) -> Result<DeviceIdentity, String> {
    use tauri_plugin_store::StoreExt;

    let store = app.store("config.json").map_err(|e| e.to_string())?;

    // 尝试从 store 读取已有身份
    if let Some(val) = store.get("device_identity") {
        if let Ok(stored) = serde_json::from_value::<StoredIdentity>(val.clone()) {
            if is_stored_identity_valid(&stored) {
                return Ok(DeviceIdentity {
                    device_id: stored.device_id,
                    public_key_raw: stored.public_key_raw,
                    private_key_raw: Some(stored.private_key_raw),
                });
            }
            eprintln!("[device_identity] 检测到本地身份缓存无效，自动重建");
        }
    }

    // 生成新密钥对
    let (signing_key, verifying_key) = generate_keypair();
    let pub_bytes = verifying_key.to_bytes();
    let priv_bytes = signing_key.to_bytes();

    let device_id = derive_device_id(&pub_bytes);
    let public_key_raw = URL_SAFE_NO_PAD.encode(pub_bytes);
    let private_key_raw = URL_SAFE_NO_PAD.encode(priv_bytes);

    let stored = StoredIdentity {
        version: 1,
        device_id: device_id.clone(),
        public_key_raw: public_key_raw.clone(),
        private_key_raw: private_key_raw.clone(),
    };

    store.set(
        "device_identity",
        serde_json::to_value(&stored).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(DeviceIdentity {
        device_id,
        public_key_raw,
        private_key_raw: Some(private_key_raw),
    })
}

/// 对 payload 进行 ed25519 签名，返回 base64url 编码的签名
///
/// # Arguments
/// * `private_key_raw` - base64url 编码的原始私钥（32 字节）
/// * `payload` - 待签名的明文字符串
pub fn sign_payload(private_key_raw: &str, payload: &str) -> Result<String, String> {
    use ed25519_dalek::Signer;

    let priv_bytes = URL_SAFE_NO_PAD
        .decode(private_key_raw)
        .map_err(|e| format!("无效的私钥 base64url: {}", e))?;

    let priv_array: [u8; 32] = priv_bytes
        .try_into()
        .map_err(|_| "私钥长度不合法（应为 32 字节）".to_string())?;

    let signing_key = SigningKey::from_bytes(&priv_array);
    let signature = signing_key.sign(payload.as_bytes());

    Ok(URL_SAFE_NO_PAD.encode(signature.to_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_well_formed_stored_identity() {
        let (signing_key, verifying_key) = generate_keypair();
        let pub_bytes = verifying_key.to_bytes();
        let priv_bytes = signing_key.to_bytes();
        let stored = StoredIdentity {
            version: 1,
            device_id: derive_device_id(&pub_bytes),
            public_key_raw: URL_SAFE_NO_PAD.encode(pub_bytes),
            private_key_raw: URL_SAFE_NO_PAD.encode(priv_bytes),
        };

        assert!(is_stored_identity_valid(&stored));
    }

    #[test]
    fn rejects_invalid_base64_private_key() {
        let (signing_key, verifying_key) = generate_keypair();
        let pub_bytes = verifying_key.to_bytes();
        let _priv_bytes = signing_key.to_bytes();
        let stored = StoredIdentity {
            version: 1,
            device_id: derive_device_id(&pub_bytes),
            public_key_raw: URL_SAFE_NO_PAD.encode(pub_bytes),
            private_key_raw: "dev-private-key".to_string(),
        };

        assert!(!is_stored_identity_valid(&stored));
    }
}
