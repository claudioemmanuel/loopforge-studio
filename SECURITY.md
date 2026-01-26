# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Loopforge Studio, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to the maintainers or use GitHub's private vulnerability reporting feature.

## What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- We will acknowledge receipt within 48 hours
- We will provide an initial assessment within 7 days
- We will work on a fix and coordinate disclosure

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

When deploying Loopforge Studio:

1. Use strong, unique values for `NEXTAUTH_SECRET` and `ENCRYPTION_KEY`
2. Never commit `.env` files to version control
3. Use HTTPS if exposing to network (optional for local-only use)
4. Keep dependencies updated
5. Restrict database access to necessary services only
