import { FaqBrowser } from '@/components/help/faq-browser';
import { HelpFrame } from '@/components/help/help-frame';

export const metadata = { title: 'FAQs' };

export default function FaqPage() {
  return (
    <HelpFrame title="FAQs" lede="Short answers to the questions groups ask first.">
      <FaqBrowser />
    </HelpFrame>
  );
}
