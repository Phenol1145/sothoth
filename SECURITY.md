# Security Policy

## Supported versions

Security fixes are provided for the latest published minor release. Before `1.0.0`, a security correction may require a
minor-version contract change when preserving the old behavior would keep the vulnerability.

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability. Use GitHub private vulnerability reporting for
`Phenol1145/sothoth` and include the affected version, input, observed result, expected boundary, and a minimal reproducer.

Sothoth treats hostile governance inputs as untrusted data. Trusted Rule Modules are same-process privileged code and are
not a sandbox. Only install exact, reviewed, integrity-locked modules.
