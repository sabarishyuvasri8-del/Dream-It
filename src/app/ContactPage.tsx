import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../lib/ThemeContext';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

const contactMarkdown = `
# Contact Us

For Dream It, the public contact information should use email rather than personal phone numbers. You can list the project contacts as Dream It Team — sabarishyuvasri@gmail.com and jeremypriyan1919@gmail.com.

I recommend keeping the phone numbers 7539945084, 9677421811, and 9790218338 private rather than displaying them publicly on the website, since publishing personal phone numbers can lead to spam and unwanted calls.

The Contact link in the footer can open a dedicated contact page or email option where users can reach the Dream It team. The Privacy link should open the complete Privacy Policy, while the Terms link should open the Terms of Service.

If the Dream It project is open source, the Source Code link should direct users to the project's public GitHub repository. If the repository is not public yet, it is better to remove the Source Code link rather than have it lead nowhere.

For a more professional product appearance, you could eventually create dedicated project addresses such as ‘sabarishyuvasri@gmail.com’ for general inquiries,’jeremypriyan1919’ for privacy-related requests, and ‘sabarishyuvasri@gmail.com’ for technical support.

This would make Dream It look more like a professional product rather than a personal student project while keeping the founders' personal contact information private.
`;

export default function ContactPage() {
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
          <ReactMarkdown>{contactMarkdown}</ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
