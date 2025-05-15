import { Link } from 'wouter';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4">LaundryLocator</h3>
            <p className="text-gray-300 text-sm">Find the closest laundromats with coin machines, 24-hour service, and affordable prices.</p>
            <div className="flex mt-4 space-x-4">
              <a href="#" className="text-gray-300 hover:text-white"><i className="fab fa-facebook-f"></i></a>
              <a href="#" className="text-gray-300 hover:text-white"><i className="fab fa-twitter"></i></a>
              <a href="#" className="text-gray-300 hover:text-white"><i className="fab fa-instagram"></i></a>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-4">For Users</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/search" className="text-gray-300 hover:text-white">Search Laundromats</Link></li>
              <li><Link href="/write-review" className="text-gray-300 hover:text-white">Write a Review</Link></li>
              <li><Link href="/app" className="text-gray-300 hover:text-white">Mobile App</Link></li>
              <li><Link href="/help" className="text-gray-300 hover:text-white">Help & Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">For Business Owners</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/claim-listing" className="text-gray-300 hover:text-white">Claim Your Listing</Link></li>
              <li><Link href="/dashboard" className="text-gray-300 hover:text-white">Business Dashboard</Link></li>
              <li><Link href="/advertising" className="text-gray-300 hover:text-white">Advertising Options</Link></li>
              <li><Link href="/success-stories" className="text-gray-300 hover:text-white">Success Stories</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/tips" className="text-gray-300 hover:text-white">Laundry Tips</Link></li>
              <li><Link href="/pricing-guide" className="text-gray-300 hover:text-white">Pricing Guide</Link></li>
              <li><Link href="/city-guides" className="text-gray-300 hover:text-white">City Guides</Link></li>
              <li><Link href="/blog" className="text-gray-300 hover:text-white">Blog</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-sm text-gray-400">
          <div className="flex flex-col md:flex-row justify-between">
            <div>
              &copy; {new Date().getFullYear()} LaundryLocator. All rights reserved.
            </div>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white">Terms of Service</Link>
              <Link href="/sitemap" className="hover:text-white">Sitemap</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
