# Object Storage

- Target: MinIO (self-hosted) or Ceph with S3-compatible gateway
- Usage: store raw job postings, user-uploaded attachments, LLM training artifacts, and long-term backups
- Deployment: run inside Kubernetes (StatefulSet) or standalone VM; expose via TLS-enabled endpoint
- Access control: manage credentials with IAM-style policies, rotate regularly, and keep read/write separation for services
- Lifecycle: configure tiering/expiration for archival data to control costs
