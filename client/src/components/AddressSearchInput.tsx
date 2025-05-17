import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const AddressSearchInput: React.FC = () => {
  const [address, setAddress] = useState('');
  const [_, setLocation] = useLocation();
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      setLocation(`/search?q=${encodeURIComponent(address.trim())}`);
    }
  };
  
  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter ZIP code or address"
          className="flex-grow text-gray-900 bg-white"
          aria-label="Search by address"
        />
        <Button type="submit" className="whitespace-nowrap">
          Search
        </Button>
      </div>
    </form>
  );
};

export default AddressSearchInput;