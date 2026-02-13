# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Loopforge Studio, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainers or use [GitHub's private vulnerability reporting](https://github.com/claudioemmanuel/loopforge-studio/security/advisories/new).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment** — within 48 hours
- **Initial assessment** — within 1 week
- **Fix and disclosure** — coordinated with reporter

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest `main` | Yes |

## Security Best Practices

When deploying Loopforge Studio:

- **Never commit `.env` files** — use `.env.example` as a template
- **Rotate secrets regularly** — JWT_SECRET, ENCRYPTION_KEY, GitHub OAuth credentials
- **Use strong encryption keys** — generate with `openssl rand -base64 32`
- **Enable HTTPS** in production
- **Restrict database access** — don't expose PostgreSQL/Redis ports publicly
- **Review agent permissions** — audit which agents have access to your repositories
