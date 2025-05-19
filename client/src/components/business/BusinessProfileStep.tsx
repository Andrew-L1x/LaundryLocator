import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Laundromat } from '@shared/schema';

// Available services and amenities for laundromats
const AVAILABLE_SERVICES = [
  { id: 'wash_and_fold', label: 'Wash & Fold Service' },
  { id: 'dry_cleaning', label: 'Dry Cleaning' },
  { id: 'self_service', label: 'Self-Service Machines' },
  { id: 'drop_off', label: 'Drop-Off Service' },
  { id: 'pickup_delivery', label: 'Pickup & Delivery' },
  { id: 'alterations', label: 'Alterations & Repairs' },
  { id: 'commercial', label: 'Commercial Laundry' },
  { id: 'bulk_service', label: 'Bulk Service' },
];

const AVAILABLE_AMENITIES = [
  { id: 'wifi', label: 'Free Wi-Fi' },
  { id: 'tv', label: 'Television' },
  { id: 'seating', label: 'Seating Area' },
  { id: 'snacks', label: 'Snack/Vending Machines' },
  { id: 'attendant', label: 'Attendant On-Site' },
  { id: 'air_conditioning', label: 'Air Conditioning' },
  { id: 'parking', label: 'Parking Available' },
  { id: 'restrooms', label: 'Restrooms' },
  { id: 'change_machine', label: 'Change Machine' },
  { id: 'large_machines', label: 'Large Capacity Machines' },
  { id: 'soap_dispenser', label: 'Soap Dispensers' },
  { id: 'security_cameras', label: 'Security Cameras' },
  { id: '24_hours', label: 'Open 24 Hours' },
];

const PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Cash' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'debit_card', label: 'Debit Card' },
  { id: 'mobile_payment', label: 'Mobile Payment' },
  { id: 'app_payment', label: 'App Payment' },
  { id: 'coins', label: 'Coins' },
  { id: 'prepaid_card', label: 'Prepaid Card' },
];

// Form schema
const profileSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  website: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description cannot exceed 500 characters'),
  services: z.array(z.string()).min(1, 'Select at least one service'),
  amenities: z.array(z.string()).optional(),
  paymentOptions: z.array(z.string()).min(1, 'Select at least one payment option'),
  hours: z.string().min(5, 'Hours of operation are required'),
  machineCount: z.object({
    washers: z.coerce.number().min(0, 'Must be a valid number'),
    dryers: z.coerce.number().min(0, 'Must be a valid number'),
  }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface BusinessProfileStepProps {
  laundromat: Laundromat;
  onComplete: (data: Partial<Laundromat>) => void;
}

const BusinessProfileStep: React.FC<BusinessProfileStepProps> = ({
  laundromat,
  onComplete,
}) => {
  // Get existing data or set defaults
  const existingServices = Array.isArray(laundromat.services) ? laundromat.services : [];
  const existingAmenities = laundromat.amenities || [];
  const existingPaymentOptions = laundromat.paymentOptions || [];
  const existingMachineCount = laundromat.machineCount || { washers: 0, dryers: 0 };
  
  // Initialize form with default values
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: laundromat.name || '',
      phone: laundromat.phone || '',
      website: laundromat.website || '',
      description: laundromat.description || '',
      services: existingServices,
      amenities: existingAmenities,
      paymentOptions: existingPaymentOptions,
      hours: laundromat.hours || '',
      machineCount: existingMachineCount,
    },
  });
  
  // Handle form submission
  const onSubmit = (data: ProfileFormValues) => {
    // Format data for API submission
    const formattedData: Partial<Laundromat> = {
      name: data.name,
      phone: data.phone,
      website: data.website,
      description: data.description,
      services: data.services,
      amenities: data.amenities,
      paymentOptions: data.paymentOptions,
      hours: data.hours,
      machineCount: data.machineCount,
    };
    
    // Pass data to parent component
    onComplete(formattedData);
  };
  
  return (
    <div>
      <h3 className="text-2xl font-bold mb-2">Complete Your Business Profile</h3>
      <p className="text-gray-600 mb-6">
        Help customers find and choose your laundromat by providing detailed information about your business.
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="services">Services & Amenities</TabsTrigger>
              <TabsTrigger value="hours">Hours & Details</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter business name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter business phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter website URL" {...field} />
                          </FormControl>
                          <FormDescription>
                            Include http:// or https:// in your URL
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your laundromat and what makes it special" 
                              className="min-h-[120px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            {field.value?.length || 0}/500 characters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="services" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="services"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Services Offered</FormLabel>
                            <FormDescription>
                              Select all services your laundromat offers
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {AVAILABLE_SERVICES.map((service) => (
                              <FormField
                                key={service.id}
                                control={form.control}
                                name="services"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={service.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(service.id)}
                                          onCheckedChange={(checked) => {
                                            const current = field.value || [];
                                            return checked
                                              ? field.onChange([...current, service.id])
                                              : field.onChange(
                                                  current.filter((value) => value !== service.id)
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {service.label}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Separator />
                    
                    <FormField
                      control={form.control}
                      name="amenities"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Amenities</FormLabel>
                            <FormDescription>
                              Select all amenities available at your laundromat
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {AVAILABLE_AMENITIES.map((amenity) => (
                              <FormField
                                key={amenity.id}
                                control={form.control}
                                name="amenities"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={amenity.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(amenity.id)}
                                          onCheckedChange={(checked) => {
                                            const current = field.value || [];
                                            return checked
                                              ? field.onChange([...current, amenity.id])
                                              : field.onChange(
                                                  current.filter((value) => value !== amenity.id)
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {amenity.label}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Separator />
                    
                    <FormField
                      control={form.control}
                      name="paymentOptions"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Payment Options</FormLabel>
                            <FormDescription>
                              Select all payment methods accepted
                            </FormDescription>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {PAYMENT_OPTIONS.map((option) => (
                              <FormField
                                key={option.id}
                                control={form.control}
                                name="paymentOptions"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={option.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(option.id)}
                                          onCheckedChange={(checked) => {
                                            const current = field.value || [];
                                            return checked
                                              ? field.onChange([...current, option.id])
                                              : field.onChange(
                                                  current.filter((value) => value !== option.id)
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {option.label}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="hours" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours of Operation</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Monday: 6am-10pm&#10;Tuesday: 6am-10pm&#10;Wednesday: 6am-10pm&#10;Thursday: 6am-10pm&#10;Friday: 6am-10pm&#10;Saturday: 7am-9pm&#10;Sunday: 7am-9pm" 
                              className="min-h-[150px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Enter each day's hours on a new line
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="machineCount.washers"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Washers</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                placeholder="Enter number of washers"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="machineCount.dryers"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Dryers</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                placeholder="Enter number of dryers"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end mt-6">
            <Button type="submit">
              Save Profile
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default BusinessProfileStep;