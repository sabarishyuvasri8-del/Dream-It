import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../lib/ThemeContext';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

const termsMarkdown = `
# Terms and Conditions

**Last Updated:** August 25, 2026
**Effective Date:** August 25, 2026

Welcome to **Dream It**.

These Terms and Conditions (“**Terms**”) govern your access to and use of the Dream It website, applications, software, artificial intelligence features, academic tools, productivity tools, and related services (collectively, the “**Services**”).

Dream It is an AI-powered academic copilot designed to help students with learning, academic problem-solving, study planning, productivity, scheduling, and related educational activities.

By accessing or using Dream It, you agree to these Terms.

If you do not agree with these Terms, you must not use the Services.

---

# 1. About Dream It

Dream It is an educational technology platform intended to assist users with academic learning and productivity.

Depending on the version of the Services available at a particular time, Dream It may provide:

* AI-powered academic assistance.
* Mathematical problem solving.
* Step-by-step explanations.
* Study planning.
* Time management.
* Scheduling.
* Academic recommendations.
* Productivity tools.
* Image-based question processing.
* Document processing.
* AI conversations.
* Personalized academic assistance.

Features may be added, modified, suspended, or removed as Dream It develops.

---

# 2. Acceptance of These Terms

By accessing, browsing, creating an account, or using any part of the Services, you confirm that:

* You have read these Terms.
* You understand these Terms.
* You agree to be bound by these Terms.
* You will comply with applicable laws.
* You will not misuse the Services.

If you are using Dream It on behalf of an organization, school, or other entity, you represent that you have appropriate authority to accept these Terms on its behalf.

---

# 3. Eligibility

You may use Dream It only if you are legally permitted to enter into these Terms under the laws applicable to you.

Because Dream It is an educational platform that may be used by students, additional requirements may apply to minors.

If you are under the age at which you can independently consent to the processing of your personal information or enter into agreements in your jurisdiction, you should use Dream It only with appropriate parental, guardian, school, or institutional involvement where required by applicable law.

---

# 4. Accounts

Certain features may require you to create an account.

When creating an account, you agree to provide information that is reasonably accurate and current.

You are responsible for:

* Maintaining the confidentiality of your account credentials.
* Protecting your password.
* Monitoring activity under your account.
* Not sharing your account credentials.
* Not allowing unauthorized individuals to use your account.
* Notifying Dream It if you suspect unauthorized access.

You are responsible for activity performed through your account unless the activity resulted from circumstances outside your reasonable control.

---

# 5. Account Security

You must not:

* Share your password intentionally.
* Attempt to obtain another user's credentials.
* Circumvent authentication systems.
* Use another person's account without authorization.
* Attempt to access restricted areas of the Services.

Dream It may temporarily restrict access to an account if we reasonably believe the account has been compromised or is being misused.

---

# 6. User Content

Dream It may allow you to submit, upload, store, process, or otherwise provide content through the Services.

This may include:

* Questions.
* Prompts.
* Text.
* Images.
* Screenshots.
* PDFs.
* Documents.
* Notes.
* Assignments.
* Study materials.
* Mathematical problems.
* Other educational content.

Collectively, this is referred to as **“User Content.”**

You retain ownership of your User Content to the extent that you legally own it.

---

# 7. License to Process User Content

To provide the Services, you grant Dream It a limited, non-exclusive, worldwide, royalty-free license to host, store, reproduce, process, transmit, and technically modify your User Content only as reasonably necessary to:

* Provide the Services.
* Process AI requests.
* Store your information.
* Display your content.
* Maintain account functionality.
* Improve reliability and security.
* Perform technical operations.

This license ends when the relevant User Content is deleted, except where retention is necessary for legitimate technical, legal, security, or backup purposes.

Dream It does not claim ownership of your User Content merely because you use the Services.

---

# 8. Your Responsibility for User Content

You are solely responsible for the User Content you submit.

You represent that you have the necessary rights or permissions to submit the content.

You must not upload content that:

* You do not have permission to use.
* Infringes another person's intellectual-property rights.
* Violates privacy rights.
* Contains stolen credentials.
* Contains malicious software.
* Violates applicable law.
* Is intended to harm another person.
* Violates these Terms.

---

# 9. Academic Integrity

Dream It is intended to support learning.

You agree not to use Dream It to engage in academic dishonesty where such use violates the rules of your school, institution, examination board, university, competition, or other educational organization.

You are responsible for understanding and following the academic-integrity rules applicable to you.

Dream It's AI-generated content should be used as a learning aid rather than automatically submitted as your own work when doing so would violate applicable academic rules.

---

# 10. AI Services

Dream It may use artificial intelligence to provide answers, explanations, recommendations, summaries, schedules, and other outputs.

AI-generated information is produced automatically and may contain errors.

Dream It does not guarantee that AI outputs will be:

* Accurate.
* Complete.
* Current.
* Appropriate.
* Error-free.
* Suitable for a particular examination.
* Suitable for direct submission.
* Consistent with a particular curriculum.

You should independently verify important information.

---

# 11. No Guarantee of Academic Results

Dream It is an assistance tool.

Using Dream It does not guarantee:

* Higher grades.
* Examination success.
* Admission to an institution.
* Improved academic performance.
* Completion of assignments.
* Correct answers.
* Achievement of academic goals.

Individual results depend on many factors outside Dream It's control.

---

# 12. AI Limitations

AI systems can make mistakes.

For example, an AI-generated response may:

* Misunderstand a question.
* Produce an incorrect calculation.
* Provide an incomplete explanation.
* Use an incorrect assumption.
* Generate outdated information.
* Produce an answer that appears convincing but is incorrect.

You are responsible for reviewing AI-generated outputs before relying on them.

---

# 13. Educational Disclaimer

Dream It provides educational assistance and general information.

The Services do not replace:

* Teachers.
* Professors.
* Tutors.
* Academic advisors.
* School administrators.
* Qualified professionals.

Dream It should not be relied upon as the sole source of information for important academic or other decisions.

---

# 14. Prohibited Uses

You agree not to use Dream It to:

### Security and Technology Abuse

* Attack or compromise systems.
* Attempt unauthorized access.
* Circumvent security controls.
* Distribute malware.
* Conduct denial-of-service attacks.
* Perform unauthorized vulnerability exploitation.
* Interfere with the Services.

### Fraud and Abuse

* Impersonate another person.
* Create fraudulent accounts.
* Conduct scams.
* Manipulate the Services.
* Abuse automated systems.

### Privacy Violations

* Collect another person's private information without authorization.
* Upload confidential information without permission.
* Attempt to access another user's information.

### Intellectual Property Abuse

* Upload copyrighted material without appropriate rights where prohibited.
* Infringe trademarks.
* Misappropriate another person's intellectual property.

### Service Abuse

* Scrape the Services at an unreasonable scale.
* Reverse engineer the Services where prohibited by law.
* Circumvent usage limits.
* Attempt to overload infrastructure.
* Use automated systems to abuse the platform.

---

# 15. Illegal Activities

You must not use Dream It for activities that violate applicable laws or regulations.

Dream It reserves the right to restrict or terminate access when reasonably necessary to address illegal or abusive activity.

---

# 16. Intellectual Property

The Dream It name, branding, logo, interface, software, design, code, visual elements, documentation, and original materials are owned by Dream It or used with appropriate rights.

Except where expressly permitted, you may not:

* Copy Dream It's software.
* Reproduce the interface.
* Redistribute proprietary components.
* Sell Dream It's proprietary materials.
* Modify and redistribute proprietary software.
* Use Dream It's branding in a misleading manner.

Your use of Dream It does not transfer ownership of Dream It's intellectual property to you.

---

# 17. User Feedback

If you voluntarily provide:

* Suggestions.
* Feature requests.
* Bug reports.
* Reviews.
* Ideas.
* Product feedback.

you grant Dream It permission to use that feedback to improve and develop the Services without owing you compensation, unless otherwise agreed in writing.

We will not intentionally treat your private User Content as public feedback merely because you use the Services.

---

# 18. Third-Party Services

Dream It may depend on third-party technologies and services.

These may include providers for:

* Hosting.
* Databases.
* AI processing.
* Authentication.
* Storage.
* Security.
* Analytics.
* Communications.

Third-party services may have separate terms and privacy policies.

Dream It is not responsible for third-party services that it does not control.

---

# 19. Third-Party Links

The Services may contain links to websites or services operated by third parties.

These links are provided for convenience.

Dream It does not control and is not responsible for:

* Third-party websites.
* Third-party content.
* Third-party security.
* Third-party privacy practices.
* Third-party terms.

You access third-party services at your own discretion.

---

# 20. Availability of the Services

We aim to keep Dream It available and reliable.

However, we do not guarantee that the Services will:

* Always be available.
* Always operate without interruption.
* Be completely error-free.
* Be free from bugs.
* Be free from security vulnerabilities.
* Work on every device.
* Work with every browser.

The Services may occasionally be unavailable because of:

* Maintenance.
* Updates.
* Technical problems.
* Infrastructure failures.
* Security incidents.
* Network problems.
* Third-party service failures.
* Events outside our reasonable control.

---

# 21. Changes to the Services

Dream It may change, update, improve, suspend, or discontinue features at any time.

We may:

* Add features.
* Remove features.
* Change interfaces.
* Change technical requirements.
* Modify usage limits.
* Introduce new functionality.
* Deprecate older functionality.

Where legally required, we may provide notice of significant changes.

---

# 22. Free and Future Paid Features

Dream It may currently provide features free of charge.

We may introduce paid features or subscription plans in the future.

If paid Services are introduced:

* Applicable prices will be displayed before purchase.
* Additional terms may apply.
* Payment providers may process transactions.
* Cancellation and refund policies may be provided separately.
* Users will be informed of material pricing changes where required by law.

Nothing in these Terms requires Dream It to offer paid Services.

---

# 23. No Financial Advice

Dream It is not a financial service.

AI-generated or platform-generated information should not be interpreted as financial, investment, tax, or legal advice.

---

# 24. Privacy

Your use of Dream It is also subject to our **Privacy Policy**, which explains how we collect, use, process, store, and protect personal information.

The Privacy Policy forms part of these Terms by reference.

---

# 25. Data and Privacy

By using Dream It, you acknowledge that certain information may need to be processed to provide the Services.

This may include:

* Account information.
* Academic information.
* User Content.
* AI prompts.
* Technical information.
* Usage information.

Please review the Privacy Policy for detailed information about data processing.

---

# 26. Account Suspension and Termination

Dream It may suspend or terminate access to an account if we reasonably believe that:

* These Terms have been violated.
* The Services are being abused.
* The account is being used for illegal activity.
* The account presents a security risk.
* The account is involved in fraud.
* Access could harm other users or the Services.

Where reasonably practical and legally permitted, we may provide notice before termination.

We may also take immediate action where necessary to protect users, systems, or legal rights.

---

# 27. User Termination

You may stop using Dream It at any time.

Where account deletion is available, you may request or initiate deletion of your account according to the available account controls.

Termination of your account does not necessarily require immediate deletion of every piece of information from backups, logs, or systems where retention is legally or technically necessary.

---

# 28. Effect of Termination

After termination:

* Your access to the Services may stop.
* Your account may become inaccessible.
* Your User Content may be deleted according to applicable retention practices.
* Certain provisions of these Terms may continue to apply.

Provisions relating to intellectual property, disclaimers, limitations of liability, dispute resolution, and other provisions intended to survive termination will continue where applicable.

---

# 29. Disclaimers

To the maximum extent permitted by applicable law, Dream It provides the Services on an **“as is”** and **“as available”** basis.

We do not guarantee that the Services will be:

* Completely accurate.
* Completely secure.
* Continuously available.
* Error-free.
* Uninterrupted.
* Suitable for every purpose.

We disclaim warranties to the extent permitted by applicable law.

Nothing in these Terms excludes warranties or rights that cannot legally be excluded.

---

# 30. Limitation of Liability

To the maximum extent permitted by applicable law, Dream It and its creators will not be responsible for indirect, incidental, consequential, special, exemplary, or punitive damages arising from or related to your use of the Services.

This may include losses relating to:

* Academic results.
* Lost data.
* Lost opportunities.
* Loss of profits.
* Business interruption.
* Reliance on AI-generated information.
* Third-party services.
* Service interruptions.

Nothing in these Terms is intended to exclude liability that cannot legally be excluded or limited under applicable law.

---

# 31. AI-Generated Information and Liability

You acknowledge that AI-generated content is probabilistic and may contain errors.

You agree not to rely solely on Dream It for decisions where an error could cause significant harm.

You are responsible for independently verifying important AI-generated information.

---

# 32. Indemnification

To the extent permitted by applicable law, you agree to defend, indemnify, and hold harmless Dream It and its creators from claims, damages, losses, liabilities, and expenses arising from:

* Your violation of these Terms.
* Your misuse of the Services.
* Your User Content.
* Your violation of another person's rights.
* Your violation of applicable law.

This provision does not apply to the extent that a claim results from Dream It's own unlawful conduct or liability that cannot legally be transferred to you.

---

# 33. Copyright Complaints

If you believe content available through Dream It infringes your copyright, you may contact us with information sufficient to identify:

* The copyrighted work.
* The allegedly infringing material.
* Your contact information.
* Evidence that you own or are authorized to act on behalf of the copyright owner.
* A description of the alleged infringement.

We may review legitimate copyright complaints and take appropriate action.

---

# 34. Responsible Use of AI

Dream It is intended to help users learn and become more productive.

We encourage users to:

* Understand explanations.
* Verify important answers.
* Use AI as a learning assistant.
* Follow academic-integrity requirements.
* Review generated work.
* Avoid blindly copying AI responses.

The goal of Dream It is to support learning rather than replace it.

---

# 35. Academic Institution Rules

If you use Dream It while enrolled in a school, college, university, coaching program, examination program, or other educational institution, you remain responsible for following that institution's rules.

If your institution prohibits AI assistance for a particular assignment, examination, or activity, you must follow those rules.

Dream It does not authorize you to violate academic policies.

---

# 36. Security Restrictions

You must not attempt to:

* Access source code that is not publicly provided.
* Access private databases.
* Access other users' accounts.
* Bypass authentication.
* Circumvent technical restrictions.
* Probe systems without authorization.
* Introduce malicious code.
* Interfere with infrastructure.
* Attempt unauthorized penetration testing.

Authorized security research may be permitted only with prior written permission from Dream It.

---

# 37. Reverse Engineering

Except where applicable law expressly permits it, you may not:

* Reverse engineer Dream It's proprietary software.
* Decompile proprietary components.
* Attempt to extract private source code.
* Reconstruct proprietary algorithms.
* Circumvent technical protections.

Nothing in this section is intended to restrict rights that cannot legally be restricted.

---

# 38. Automated Access

You may not use bots, scripts, crawlers, scrapers, or automated systems to access Dream It in a way that:

* Overloads the Services.
* Circumvents restrictions.
* Collects private information.
* Interferes with normal operation.
* Violates these Terms.

Reasonable indexing by publicly permitted search engines is not prohibited unless technically restricted.

---

# 39. Export and Sanctions Compliance

You agree not to use Dream It in violation of applicable export-control, sanctions, or trade laws.

Where applicable, you are responsible for complying with laws governing your location and use of technology.

---

# 40. Changes to These Terms

Dream It may update these Terms from time to time.

When we make changes, we will update the **Last Updated** date.

For material changes, we may provide additional notice where appropriate or legally required.

Your continued use of the Services after updated Terms become effective constitutes acceptance of the updated Terms to the extent permitted by applicable law.

---

# 41. Governing Law

These Terms are intended to operate in accordance with applicable laws.

To the extent legally permitted, these Terms shall be governed by the applicable laws of **India**.

Nothing in this section is intended to remove rights that cannot legally be excluded under applicable law.

---

# 42. Dispute Resolution

If a dispute arises regarding Dream It, we encourage you to contact us first so that we can attempt to resolve the issue informally.

You may contact:

**Jermy**
**Email:** [jeremypriyan1919@gmail.com](mailto:jeremypriyan1919@gmail.com)
**Phone:** +91 75399 45084

If the dispute cannot be resolved informally, the parties may pursue remedies available under applicable law.

---

# 43. Severability

If any provision of these Terms is found to be invalid, unlawful, or unenforceable, that provision will be interpreted or modified to the minimum extent necessary to make it enforceable where legally permitted.

The remaining provisions will continue to apply.

---

# 44. No Waiver

If Dream It does not immediately enforce a provision of these Terms, that does not mean we waive our right to enforce that provision later.

---

# 45. Entire Agreement

These Terms, together with the Privacy Policy and any additional terms specifically applicable to particular Services, constitute the agreement governing your use of Dream It, except where additional written agreements apply.

---

# 46. Assignment

You may not transfer or assign your rights or obligations under these Terms where prohibited by applicable law.

Dream It may transfer or assign these Terms as part of a merger, acquisition, restructuring, sale of assets, or similar transaction.

---

# 47. Contact Information

For questions, concerns, support requests, legal notices, or other communications regarding these Terms, contact:

**Dream It**

**Contact Person:** Jermy

**Email:** [jeremypriyan1919@gmail.com](mailto:jeremypriyan1919@gmail.com)

**Phone:** +91 75399 45084

**Country:** India

---

# 48. Acceptance

By accessing or using Dream It, you acknowledge that:

* You have read these Terms.
* You understand these Terms.
* You agree to comply with these Terms.
* You understand that AI-generated information may contain errors.
* You understand that Dream It is an educational assistance tool.
* You will use the Services responsibly.
* You will comply with applicable laws and academic rules.

If you do not agree with these Terms, you must not use Dream It.

---

# 49. Effective Date

These Terms are effective as of:

**August 25, 2026**

**Last Updated:** August 25, 2026

---

# Quick Summary

### Dream It is:

**An AI-powered academic copilot designed to help students learn, solve problems, plan their studies, and improve productivity.**

### You can:

* Use Dream It for academic assistance.
* Submit educational questions.
* Upload permitted educational content.
* Use AI-powered features.
* Create and manage your account.
* Use study and productivity tools.

### You cannot:

* Abuse the platform.
* Hack or attack the Services.
* Access another user's account.
* Upload content you do not have permission to use.
* Use Dream It for unlawful activity.
* Circumvent security or technical restrictions.
* Use Dream It to violate academic-integrity rules.

### Remember:

**AI can make mistakes.**

Always verify important information and follow the rules of your school, institution, examination board, or other applicable authority.

---

**©️ 2026 Dream It. All rights reserved.**

**Privacy Contact:** Jermy
**Email:** [jeremypriyan1919@gmail.com](mailto:jeremypriyan1919@gmail.com)
**Phone:** +91 75399 45084
**Country:** India
`;

export default function TermsOfService() {
  const { themeConfig } = useTheme();

  return (
    <main
      className={`min-h-screen py-16 px-6 font-[DM_Sans] ${themeConfig.cssClass}`}
      style={{ backgroundColor: "var(--m-bg)", color: "var(--m-text)" }}
    >
      <div className="max-w-4xl mx-auto relative bg-white/5 dark:bg-black/20 p-8 md:p-12 rounded-3xl border border-white/10 dark:border-white/5 shadow-xl backdrop-blur-sm">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 mb-8 text-sm font-bold hover:underline opacity-80 hover:opacity-100 transition-opacity"
          style={{ color: "var(--m-primary)" }}
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div 
          className="prose prose-sm md:prose-base max-w-none"
        >
          {/* We inject simple custom styling to handle prose text coloring correctly depending on the theme */}
          <style dangerouslySetInnerHTML={{
            __html: `
            .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6, .prose strong {
              color: var(--m-text-heading);
            }
            .prose p, .prose li {
              color: var(--m-text-sub);
            }
            .prose a {
              color: var(--m-primary);
            }
            `
          }} />
          <ReactMarkdown>{termsMarkdown}</ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
