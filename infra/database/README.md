# Database Infrastructure

- Target: Amazon RDS for PostgreSQL (or Aurora PostgreSQL if auto-scaling is required)
- Environments: provision separate instances for `dev`, `stage`, and `prod`
- Recommended tooling: Terraform/Pulumi for IaC, AWS Secrets Manager for credentials, CloudWatch for metrics/alerts
- Migration flow: manage schema updates from `data/schema/` and promote via CI/CD
- Backup strategy: automated snapshots + object storage archival (see `../storage`)
