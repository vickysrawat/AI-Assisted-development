# Cloud Security Checks

## AWS

### IAM
| Check | CIS Control | Severity |
|-------|-------------|----------|
| Root account has MFA enabled | 1.5 | Critical |
| No root access keys exist | 1.4 | Critical |
| IAM policies do not allow `*:*` | 1.16 | High |
| MFA enabled for all IAM users with console access | 1.10 | High |
| Access keys rotated within 90 days | 1.14 | Medium |
| Unused credentials disabled after 45 days | 1.12 | Medium |
| No inline IAM policies | 1.16 | Low |

### S3
| Check | Severity |
|-------|----------|
| Block Public Access enabled at account level | Critical |
| No bucket ACLs set to `public-read` or `public-read-write` | Critical |
| Server-side encryption enabled (SSE-S3 or SSE-KMS) | High |
| Bucket versioning enabled for sensitive buckets | Medium |
| S3 access logging enabled | Medium |
| MFA Delete enabled for sensitive buckets | Medium |

### Networking
| Check | CIS Control | Severity |
|-------|-------------|----------|
| No security group allows 0.0.0.0/0 on port 22/3389 | 5.2 / 5.3 | Critical |
| VPC Flow Logs enabled | 3.9 | High |
| No security group allows unrestricted inbound on all ports | 5.4 | High |
| Default VPC not used in production | 5.6 | Medium |

### Logging & Monitoring
| Check | CIS Control | Severity |
|-------|-------------|----------|
| CloudTrail enabled in all regions | 3.1 | Critical |
| CloudTrail log validation enabled | 3.2 | High |
| CloudTrail integrated with CloudWatch Logs | 3.4 | High |
| GuardDuty enabled | — | High |
| Config enabled | 3.5 | Medium |
| S3 bucket for CloudTrail logs not publicly accessible | 3.3 | Critical |

### Secrets & KMS
| Check | Severity |
|-------|----------|
| No hardcoded credentials in Lambda env vars or EC2 user data | Critical |
| KMS key rotation enabled | Medium |
| Secrets Manager used (not SSM Parameter Store plaintext) | High |

---

## GCP

### IAM
| Check | Severity |
|-------|----------|
| No service account has `roles/owner` | Critical |
| No user has `roles/editor` or `roles/owner` at project level unnecessarily | High |
| Service account keys rotated within 90 days | High |
| Workload Identity used instead of SA keys where possible | High |
| Default service account not used for Compute instances | Medium |

### GCS (Storage)
| Check | Severity |
|-------|----------|
| No bucket is publicly accessible (`allUsers` / `allAuthenticatedUsers`) | Critical |
| Bucket-level uniform access enabled (disable legacy ACLs) | High |
| Object versioning enabled for sensitive buckets | Medium |

### Networking
| Check | Severity |
|-------|----------|
| Firewall rules do not allow 0.0.0.0/0 on SSH (22) or RDP (3389) | Critical |
| VPC Flow Logs enabled | High |
| No default network in production projects | Medium |

### Logging
| Check | Severity |
|-------|----------|
| Cloud Audit Logs — Admin Activity enabled | Critical |
| Cloud Audit Logs — Data Access enabled for sensitive services | High |
| Log sink exports to centralised SIEM | Medium |

---

## Azure

### IAM / Entra ID
| Check | Severity |
|-------|----------|
| MFA required for all users (Conditional Access) | Critical |
| No guest accounts with privileged roles | High |
| Privileged Identity Management (PIM) used for privileged roles | High |
| No subscription-level `Owner` assignments to service principals unnecessarily | High |
| Access reviews configured for privileged roles | Medium |

### Storage
| Check | Severity |
|-------|----------|
| Storage account public blob access disabled | Critical |
| Storage accounts use private endpoints or service endpoints | High |
| Storage accounts enforce HTTPS (minimum TLS 1.2) | High |
| Storage account soft delete enabled | Medium |

### Networking
| Check | Severity |
|-------|----------|
| NSG rules do not allow inbound 0.0.0.0/0 on 22/3389 | Critical |
| NSG Flow Logs enabled | High |
| Azure Firewall or NVA in use for egress | Medium |

### Monitoring
| Check | Severity |
|-------|----------|
| Microsoft Defender for Cloud enabled (Standard tier) | Critical |
| Diagnostic settings enabled for subscription activity log | High |
| Log Analytics workspace centralised | Medium |
| Alerts configured for privileged role assignments | High |

---

## IaC Checks (Terraform / CDK / CloudFormation)

| Pattern | Severity |
|---------|----------|
| IAM policy with `"Action": "*"` and `"Resource": "*"` | Critical |
| Security group ingress `cidr = "0.0.0.0/0"` on sensitive ports | Critical |
| S3 bucket with `acl = "public-read"` | Critical |
| RDS instance with `publicly_accessible = true` | High |
| EBS / RDS / S3 without encryption | High |
| Lambda without VPC or with over-permissive execution role | High |
| CloudTrail without `enable_log_file_validation = true` | Medium |
| Resources without tags (ownership/classification) | Low |
