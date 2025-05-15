import { LaundryTip } from '@/types/laundromat';

interface LaundryTipsProps {
  tips: LaundryTip[];
}

const LaundryTips = ({ tips }: LaundryTipsProps) => {
  return (
    <section className="mt-12 bg-white rounded-lg border p-6 shadow-sm">
      <h2 className="text-2xl font-bold mb-4">Laundry Tips & Resources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tips.map((tip) => (
          <div key={tip.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2 text-primary">{tip.title}</h3>
            <p className="text-gray-600 mb-3">{tip.description}</p>
            <a href={tip.url} className="text-primary font-medium hover:underline">Read More →</a>
          </div>
        ))}
      </div>
    </section>
  );
};

export default LaundryTips;
