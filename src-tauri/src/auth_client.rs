use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthRequest {
    pub token: String,
    pub machine_id: String,
    /// exec 的 ed25519 公钥（base64url），首次 verify 时上报给 tenant，用于设备身份绑定
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub allowed: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub async fn check_auth(
    auth_endpoint: String,
    token: String,
    machine_id: String,
    public_key: Option<String>,
) -> Result<AuthResponse, String> {
    let client = reqwest::Client::new();
    let payload = AuthRequest {
        token,
        machine_id,
        public_key,
    };

    let response = client
        .post(&auth_endpoint)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Auth request failed: {}", e))?;

    let auth_response = response
        .json::<AuthResponse>()
        .await
        .map_err(|e| format!("Invalid auth response: {}", e))?;

    Ok(auth_response)
}
