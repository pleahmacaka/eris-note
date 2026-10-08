use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

use iroh::{Endpoint, EndpointId};
use iroh_blobs::api::blobs::{AddPathOptions, ImportMode};
use iroh_blobs::api::downloader::{Downloader, Shuffled};
use iroh_blobs::provider::events::{
    AbortReason, ConnectMode, EventMask, EventSender, ProviderMessage, RequestMode,
};
use iroh_blobs::store::fs::options::Options;
use iroh_blobs::store::fs::FsStore;
use iroh_blobs::store::GcConfig;
use iroh_blobs::{BlobFormat, BlobsProtocol, Hash, HashAndFormat};
use n0_future::StreamExt;

const GC_INTERVAL: Duration = Duration::from_secs(3_600);
const TAG: &str = "vault-";
const STAGING: &str = ".note-sync-";

pub struct Blobs {
    store: FsStore,
    downloader: Downloader,
}

fn fail(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn verdict(allowed: bool) -> Result<(), AbortReason> {
    if allowed {
        Ok(())
    } else {
        Err(AbortReason::Permission)
    }
}

// iroh-blobs 0.103 gates every request kind on `mask.get`, so get_many, push and observe arrive here too
fn guard(knows: Arc<dyn Fn(&EndpointId) -> bool + Send + Sync>) -> EventSender {
    let mask = EventMask {
        connected: ConnectMode::Intercept,
        get: RequestMode::Intercept,
        ..EventMask::DEFAULT
    };

    let (sender, mut events) = EventSender::channel(32, mask);

    tauri::async_runtime::spawn(async move {
        let mut peers: HashMap<u64, EndpointId> = HashMap::new();

        while let Some(event) = events.recv().await {
            match event {
                ProviderMessage::ClientConnected(message) => {
                    if let Some(peer) = message.endpoint_id {
                        peers.insert(message.connection_id, peer);
                    }

                    message.tx.send(Ok(())).await.ok();
                }
                ProviderMessage::ConnectionClosed(message) => {
                    peers.remove(&message.connection_id);
                }
                ProviderMessage::GetRequestReceived(message) => {
                    let allowed = message.request.ranges.is_blob()
                        && peers.get(&message.connection_id).is_some_and(|peer| knows(peer));

                    message.tx.send(verdict(allowed)).await.ok();
                }
                ProviderMessage::GetManyRequestReceived(message) => {
                    message.tx.send(verdict(false)).await.ok();
                }
                ProviderMessage::PushRequestReceived(message) => {
                    message.tx.send(verdict(false)).await.ok();
                }
                ProviderMessage::ObserveRequestReceived(message) => {
                    message.tx.send(verdict(false)).await.ok();
                }
                _ => {}
            }
        }
    });

    sender
}

impl Blobs {
    pub async fn open(
        dir: &Path,
        endpoint: &Endpoint,
        knows: Arc<dyn Fn(&EndpointId) -> bool + Send + Sync>,
    ) -> Result<(Self, BlobsProtocol), String> {
        let root = dir.join("blobs");
        let mut options = Options::new(&root);

        options.gc = Some(GcConfig {
            interval: GC_INTERVAL,
            add_protected: None,
        });

        let store = FsStore::load_with_opts(root.join("blobs.db"), options)
            .await
            .map_err(fail)?;
        let downloader = store.downloader(endpoint);
        let provider = BlobsProtocol::new(&store, Some(guard(knows)));

        Ok((Self { store, downloader }, provider))
    }

    async fn keep(&self, hash: Hash) -> Result<(), String> {
        self.store
            .tags()
            .set(format!("{TAG}{hash}"), HashAndFormat::raw(hash))
            .await
            .map_err(fail)
    }

    pub async fn add(&self, file: PathBuf) -> Result<String, String> {
        let batch = self.store.batch().await.map_err(fail)?;
        let tag = batch
            .add_path_with_opts(AddPathOptions {
                path: file,
                format: BlobFormat::Raw,
                mode: ImportMode::TryReference,
            })
            .await
            .map_err(fail)?;
        let hash = tag.hash();

        self.keep(hash).await?;

        Ok(hash.to_string())
    }

    pub async fn fetch(&self, hash: &str, target: &Path, peers: Vec<EndpointId>) -> Result<(), String> {
        let hash = Hash::from_str(hash).map_err(fail)?;

        if peers.is_empty() {
            return Err("연결된 기기 없음".into());
        }

        self.downloader
            .download(HashAndFormat::raw(hash), Shuffled::new(peers))
            .await
            .map_err(fail)?;
        self.keep(hash).await?;

        let folder = target.parent().ok_or("잘못된 경로")?;

        std::fs::create_dir_all(folder).map_err(fail)?;

        let staging = folder.join(format!("{STAGING}{hash}"));
        let placed = async {
            self.store
                .blobs()
                .export(hash, &staging)
                .await
                .map_err(fail)?;

            std::fs::rename(&staging, target).map_err(fail)
        }
        .await;

        if placed.is_err() {
            let _ = std::fs::remove_file(&staging);
        }

        placed
    }

    pub async fn retain(&self, hashes: Vec<String>) -> Result<(), String> {
        let wanted: HashSet<String> = hashes.into_iter().map(|hash| format!("{TAG}{hash}")).collect();
        let mut stale = Vec::new();
        let mut tags = self.store.tags().list_prefix(TAG).await.map_err(fail)?;

        while let Some(tag) = tags.next().await {
            let tag = tag.map_err(fail)?;
            let name = String::from_utf8_lossy(tag.name.as_ref()).into_owned();

            if !wanted.contains(&name) {
                stale.push(name);
            }
        }

        for name in stale {
            self.store.tags().delete(name).await.map_err(fail)?;
        }

        Ok(())
    }
}
