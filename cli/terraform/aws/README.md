# OpenCompany on AWS (Terraform)

One login-gated EC2 instance running OpenCompany. File layout and workflow
follow the HashiCorp AWS get-started tutorial
(https://developer.hashicorp.com/terraform/tutorials/aws-get-started):
`terraform.tf` (providers), `main.tf`, `variables.tf`, `outputs.tf`.

Settings are the ones validated on a live t3.micro in September 2026:

| Setting | Value | Why |
|---|---|---|
| Instance | `t3.micro`, 2 vCPU, 1 GiB | Smallest size the app runs on (backend ~200 MB + Temporal ~150 MB). 512 MB OOM-loops. |
| Credit mode | `standard` | Caps compute at the hourly rate under continuous CPU load. |
| Root disk | 10 GiB gp3, deleted with the instance | A fresh install uses ~4.5 GiB. |
| Image | Ubuntu 24.04 LTS (Canonical) | Python 3.12 inside the server's `<3.13` pin; apt Node 18 is enough. |
| Install | `install.sh` as `ubuntu`, no sudo | Root installs leave the venvs unusable by the login user (errors.md #16). |
| Runtime | `company serve` under systemd as `ubuntu` | `AmbientCapabilities=CAP_NET_BIND_SERVICE` for port 80. |
| Security group | 22, 80, 443 and the app port from `allow_cidr` | Same shape as the gcp module. |

```bash
cd cli/terraform/aws
terraform init
terraform fmt
terraform validate
terraform apply -var key_name=<your-key-pair> -var opencompany_version=0.1.1 \
  -var-file=app_env.auto.tfvars.json
terraform output url
```

`app_env` carries the owner login, fresh JWT/encryption keys, `PORT=80`,
`DATA_DIR=/var/lib/opencompany` and `TEMPORAL_ENABLED=false`. Generate it with
`cli/commands/deploy/_secrets.py build_app_env(owner_email=..., owner_password=...,
port=80)` and write it as `{"app_env": {...}}` to `app_env.auto.tfvars.json`
(gitignored) rather than typing it by hand. First boot takes 3 to 5 minutes.

Uses the AWS CLI's default credential chain. `company deploy` cannot drive this
module yet; it needs an AWS entry in `cli/commands/deploy/providers`.

Cost at us-east-1 list prices: about $12/month fixed (instance, disk, public
IPv4), and CPU load cannot raise it. Egress past the free 100 GB/month is the
only open-ended line.
