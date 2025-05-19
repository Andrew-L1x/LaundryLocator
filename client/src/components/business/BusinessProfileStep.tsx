import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from '@/components/ui/file-upload';
import { Store, Building2, Clock, Tag, ListChecks } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// Services and amenities available for laundromats
const availableServices = [
  { id: 'washAndFold', label: 'Wash & Fold Service' },
  { id: 'dryClean', label: 'Dry Cleaning' },
  { id: 'dropOff', label: 'Drop-off Service' },
  { id: 'selfService', label: 'Self-Service' },
  { id: 'delivery', label: 'Pickup & Delivery' },
  { id: 'commercial', label: 'Commercial Laundry' },
  { id: 'alterations', label: 'Alterations & Repairs' },
  { id: 'specialItems', label: 'Special Items (Rugs, Comforters)' },
];

const availableAmenities = [
  { id: 'wifi', label: 'Free WiFi' },
  { id: 'attendant', label: 'Attendant On-site' },
  { id: 'parking', label: 'Free Parking' },
  { id: 'largeCapacity', label: 'Large Capacity Machines' },
  { id: 'vending', label: 'Vending Machines' },
  { id: 'lounge', label: 'Waiting Area/Lounge' },
  { id: 'tv', label: 'Television' },
  { id: 'restroom', label: 'Public Restroom' },
  { id: 'childplay', label: 'Children\'s Play Area' },
  { id: 'accessible', label: 'Wheelchair Accessible' },
];

const availablePayments = [
  { id: 'cash', label: 'Cash' },
  { id: 'credit', label: 'Credit/Debit Cards' },
  { id: 'mobile', label: 'Mobile Payment (Apple Pay, Google Pay)' },
  { id: 'app', label: 'Laundromat App' },
  { id: 'coinop', label: 'Coin-Operated' },
  { id: 'card', label: 'Laundry Card' },
];

// Form validation schema
const profileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url('Please enter a valid URL').optional().nullable(),
  hours: z.string().optional(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  services: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  paymentOptions: z.array(z.string()).optional(),
  machineCount: z.object({
    washers: z.preprocess(
      (val) => val === '' ? undefined : Number(val),
      z.number().nonnegative().optional()
    ),
    dryers: z.preprocess(
      (val) => val === '' ? undefined : Number(val),
      z.number().nonnegative().optional()
    ),
  }).optional(),
  photos: z.array(z.any()).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface BusinessProfileStepProps {
  onComplete: (data: ProfileFormValues) => void;
  laundromat: any;
  isLoading?: boolean;
}

const BusinessProfileStep: React.FC<BusinessProfileStepProps> = ({ 
  onComplete, 
  laundromat, 
  isLoading = false
}) => {
  // Initialize form with existing data if available
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: laundromat?.name || '',
      phone: laundromat?.phone || '',
      website: laundromat?.website || '',
      hours: laundromat?.hours || '',
      description: laundromat?.description || '',
      services: laundromat?.services || [],
      amenities: laundromat?.amenities || [],
      paymentOptions: laundromat?.paymentOptions || [],
      machineCount: {
        washers: laundromat?.machineCount?.washers || '',
        dryers: laundromat?.machineCount?.dryers || '',
      },
      photos: [],
    },
  });
  
  // Handle form submission
  const onSubmit = (data: ProfileFormValues) => {
    onComplete(data);
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Business Profile</h2>
        <p className="text-gray-500 mt-2">
          Enhance your business profile with detailed information
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Store className="mr-2 h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Business name" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription>
                      Confirm or update your business name
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} value={field.value || ''} />
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
                        <Input placeholder="https://example.com" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell customers about your laundromat, special services, and unique features..."
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0}/500 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        placeholder={`Monday-Friday: 7:00 AM - 10:00 PM\nSaturday: 8:00 AM - 9:00 PM\nSunday: 8:00 AM - 8:00 PM`}
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter your operating hours for each day
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ListChecks className="mr-2 h-5 w-5" />
                Services & Amenities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Services Offered</h3>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="services"
                    render={() => (
                      <>
                        {availableServices.map((service) => (
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
                                        return checked
                                          ? field.onChange([...(field.value || []), service.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== service.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {service.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </>
                    )}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-sm font-medium mb-3">Amenities</h3>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="amenities"
                    render={() => (
                      <>
                        {availableAmenities.map((amenity) => (
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
                                        return checked
                                          ? field.onChange([...(field.value || []), amenity.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== amenity.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {amenity.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </>
                    )}
                  />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-sm font-medium mb-3">Payment Options</h3>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="paymentOptions"
                    render={() => (
                      <>
                        {availablePayments.map((payment) => (
                          <FormField
                            key={payment.id}
                            control={form.control}
                            name="paymentOptions"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={payment.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(payment.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), payment.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== payment.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {payment.label}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Equipment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="machineCount.washers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Washers</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          min="0"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => field.onChange(e.target.value)}
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
                          placeholder="0" 
                          min="0"
                          {...field}
                          value={field.value?.toString() || ''}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="mr-2 h-5 w-5" />
                Photos (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="photos"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <FileUpload
                        value={field.value || []}
                        onChange={field.onChange}
                        accept="image/*"
                        multiple={true}
                        maxFiles={5}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload up to 5 photos of your laundromat (interior, exterior, equipment, etc.)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full md:w-auto"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Saving...
                </>
              ) : (
                'Save Profile & Continue'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default BusinessProfileStep;