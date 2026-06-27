# Compliance Controls Reference

## SOC2 Trust Services Criteria (TSC) — Key Controls

| Control | Name | Description |
|---------|------|-------------|
| CC6.1 | Logical access security | Restrict access to authorised users; MFA; principle of least privilege |
| CC6.2 | Access provisioning | Formal provisioning/deprovisioning process; access reviews |
| CC6.3 | Role-based access | Access based on job function; segregation of duties |
| CC6.6 | External access | Controls for remote/third-party access |
| CC6.7 | Data transmission | Encryption in transit |
| CC6.8 | Malicious software | Anti-malware, EDR, vulnerability management |
| CC7.1 | System monitoring | Log collection, SIEM, anomaly detection |
| CC7.2 | Vulnerability management | Scanning, patching SLAs |
| CC7.3 | Incident response | Documented IR plan, testing |
| CC7.4 | Security incidents | Detection, containment, notification |
| CC8.1 | Change management | Change control, testing, approval process |
| A1.1 | Availability | Capacity planning, availability monitoring |
| A1.2 | Recovery | Backup, RTO/RPO, DR testing |
| C1.1 | Confidentiality | Data classification, DLP |

## ISO 27001:2022 — Key Annex A Controls

| Control | Name |
|---------|------|
| 5.1 | Information security policies |
| 5.2 | Information security roles |
| 5.15 | Access control policy |
| 5.16 | Identity management |
| 5.17 | Authentication information |
| 6.3 | Information security awareness |
| 7.10 | Storage media |
| 8.2 | Privileged access rights |
| 8.4 | Access to source code |
| 8.7 | Protection against malware |
| 8.8 | Management of technical vulnerabilities |
| 8.9 | Configuration management |
| 8.11 | Data masking |
| 8.12 | Data leakage prevention |
| 8.15 | Logging |
| 8.16 | Monitoring activities |
| 8.20 | Networks security |
| 8.24 | Use of cryptography |
| 8.25 | Secure development lifecycle |
| 8.26 | Application security requirements |
| 8.28 | Secure coding |

## NIST CSF 2.0 — Functions & Key Categories

| Function | Category | Description |
|----------|----------|-------------|
| GOVERN | GV.OC | Organisational context |
| GOVERN | GV.RM | Risk management strategy |
| IDENTIFY | ID.AM | Asset management |
| IDENTIFY | ID.RA | Risk assessment |
| PROTECT | PR.AA | Identity management & access control |
| PROTECT | PR.AT | Awareness & training |
| PROTECT | PR.DS | Data security |
| PROTECT | PR.PS | Platform security (hardening) |
| PROTECT | PR.IR | Technology infrastructure resilience |
| DETECT | DE.CM | Continuous monitoring |
| DETECT | DE.AE | Adverse event analysis |
| RESPOND | RS.MA | Incident management |
| RESPOND | RS.AN | Incident analysis |
| RECOVER | RC.RP | Incident recovery plan |
| RECOVER | RC.CO | Incident recovery communication |

## PCI-DSS v4 — Requirements Summary

| Req | Title |
|-----|-------|
| 1 | Install and maintain network security controls |
| 2 | Apply secure configurations |
| 3 | Protect stored account data |
| 4 | Protect cardholder data in transit (TLS 1.2+) |
| 5 | Protect from malicious software |
| 6 | Develop and maintain secure systems (SDLC, patching) |
| 7 | Restrict access by business need to know |
| 8 | Identify users and authenticate access (MFA required) |
| 9 | Restrict physical access |
| 10 | Log and monitor access |
| 11 | Test security regularly (pen test, ASV scans) |
| 12 | Support information security with policies |

## HIPAA Security Rule — Technical Safeguards

| Standard | Implementation Spec | Required/Addressable |
|----------|--------------------|--------------------|
| Access Control | Unique user IDs | Required |
| Access Control | Emergency access | Required |
| Access Control | Auto logoff | Addressable |
| Access Control | Encryption/decryption | Addressable |
| Audit Controls | Activity logs | Required |
| Integrity | Authentication mechanism | Addressable |
| Transmission Security | Encryption | Addressable |
