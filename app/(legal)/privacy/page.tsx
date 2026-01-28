import { PageHeader } from "@/components/institutional/page-header";
import { ProseContent } from "@/components/institutional/prose-content";

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="Privacy Policy"
        subtitle="Last updated: January 2026"
      />

      <ProseContent>
        <h2>Introduction</h2>
        <p>
          At Loopforge Studio (&quot;we&quot;, &quot;our&quot;, or
          &quot;us&quot;), we are committed to protecting your privacy. This
          Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you use our service.
        </p>

        <h2>Information We Collect</h2>

        <h3>Information You Provide</h3>
        <ul>
          <li>
            <strong>Account Information:</strong> When you sign up via GitHub
            OAuth, we receive your GitHub username, email address, and profile
            information.
          </li>
          <li>
            <strong>API Keys:</strong> If you provide API keys for AI providers
            (Anthropic, OpenAI, Google), these are encrypted using AES-256-GCM
            and stored securely.
          </li>
          <li>
            <strong>Task Data:</strong> The tasks you create, including
            descriptions, brainstorming conversations, and execution logs.
          </li>
        </ul>

        <h3>Information Collected Automatically</h3>
        <ul>
          <li>
            <strong>Usage Data:</strong> We collect information about how you
            interact with our service, including pages visited and features
            used.
          </li>
          <li>
            <strong>Device Information:</strong> Browser type, operating system,
            and IP address for security and analytics purposes.
          </li>
        </ul>

        <h2>How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve our services</li>
          <li>Process and execute your coding tasks</li>
          <li>Communicate with you about service updates</li>
          <li>Monitor and analyze usage patterns</li>
          <li>Detect and prevent security incidents</li>
        </ul>

        <h2>Data Storage and Security</h2>
        <p>
          We implement industry-standard security measures to protect your data:
        </p>
        <ul>
          <li>
            All API keys and tokens are encrypted at rest using AES-256-GCM
            encryption
          </li>
          <li>Data is transmitted using TLS/SSL encryption</li>
          <li>We do not store your source code on our servers</li>
          <li>
            Repository access is temporary and used only during task execution
          </li>
        </ul>

        <h2>Third-Party Services</h2>
        <p>Our service integrates with the following third parties:</p>
        <ul>
          <li>
            <strong>GitHub:</strong> For authentication and repository access
          </li>
          <li>
            <strong>AI Providers:</strong> Anthropic, OpenAI, and Google for AI
            processing (using your own API keys)
          </li>
        </ul>
        <p>
          Each third-party service has its own privacy policy, and we encourage
          you to review them.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. You can
          request deletion of your account and associated data at any time by
          contacting us.
        </p>

        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export your data in a portable format</li>
          <li>Opt-out of marketing communications</li>
        </ul>

        <h2>Self-Hosted Deployments</h2>
        <p>
          If you self-host Loopforge Studio, you are responsible for the privacy
          and security of data on your own infrastructure. This privacy policy
          applies only to our hosted service.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of any changes by posting the new policy on this page and updating
          the &quot;Last updated&quot; date.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at{" "}
          <a href="mailto:privacy@loopforge.dev">privacy@loopforge.dev</a>.
        </p>
      </ProseContent>
    </>
  );
}
