import { useState, FormEvent } from 'react';
import { useToast } from '@/hooks/use-toast';

const ClaimListingForm = () => {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!businessName || !email || !phone) {
      toast({
        title: "Form Error",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }
    
    // In a real application, this would send data to the server
    // For now, just show a success message
    toast({
      title: "Claim Submitted",
      description: "Thanks for submitting! We'll review your claim and contact you soon.",
      variant: "default"
    });
    
    // Reset form
    setBusinessName('');
    setEmail('');
    setPhone('');
  };

  return (
    <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold">Laundromat Owner?</h3>
      <p className="text-sm mb-3">Claim your listing to update info and respond to reviews</p>
      <form id="claim-listing-form" className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Business Name" 
          className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <input 
          type="email" 
          placeholder="Email Address" 
          className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          type="tel" 
          placeholder="Phone Number" 
          className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button 
          type="submit" 
          className="bg-primary text-white font-medium p-2 rounded hover:bg-primary/90"
        >
          Claim Your Listing
        </button>
      </form>
    </div>
  );
};

export default ClaimListingForm;
