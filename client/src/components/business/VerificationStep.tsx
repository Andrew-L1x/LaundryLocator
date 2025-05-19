import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Laundromat } from '@shared/schema';

// Form schema
const verificationSchema = z.object({
  method: z.enum(['document', 'utility', 'phone', 'mail']),
  files: z.array(z.any()).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type VerificationFormValues = z.infer<typeof verificationSchema>;

interface VerificationStepProps {
  laundromat: Laundromat;
  onComplete: (data: VerificationFormValues) => void;
}

const VerificationStep: React.FC<VerificationStepProps> = ({
  laundromat,
  onComplete,
}) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);
  
  // Initialize form with default values
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      method: 'document',
      files: [],
      phone: laundromat.phone || '',
      address: laundromat.address || '',
    },
  });
  
  const selectedMethod = form.watch('method');
  
  // Handle form submission
  const onSubmit = async (data: VerificationFormValues) => {
    try {
      setIsUploading(true);
      
      // For document and utility bill methods, simulate file upload
      if (data.method === 'document' || data.method === 'utility') {
        // In a real app, we would handle file uploads here
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // For phone method, ensure phone number is provided
      if (data.method === 'phone' && !data.phone) {
        toast({
          title: 'Verification Failed',
          description: 'Please provide a valid phone number for verification.',
          variant: 'destructive',
        });
        setIsUploading(false);
        return;
      }
      
      // For mail method, ensure address is provided
      if (data.method === 'mail' && !data.address) {
        toast({
          title: 'Verification Failed',
          description: 'Please provide a valid mailing address for verification.',
          variant: 'destructive',
        });
        setIsUploading(false);
        return;
      }
      
      setHasVerified(true);
      toast({
        title: 'Verification Successful',
        description: 'Your business ownership has been verified.',
      });
      
      // Pass verification data to parent component
      onComplete(data);
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: 'Verification Failed',
        description: 'There was a problem verifying your business ownership. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div>
      <h3 className="text-2xl font-bold mb-2">Verify Business Ownership</h3>
      <p className="text-gray-600 mb-6">
        Please select one of the verification methods below to confirm your ownership of {laundromat.name}.
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem className="mb-6">
                <FormLabel className="text-lg font-medium">Verification Method</FormLabel>
                <FormDescription>
                  Select one of the following verification methods
                </FormDescription>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"
                >
                  <FormItem>
                    <FormLabel className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="document" />
                      </FormControl>
                      <div>
                        <p className="font-medium">Business Documents</p>
                        <p className="text-sm text-gray-500">Upload business license or registration</p>
                      </div>
                    </FormLabel>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="utility" />
                      </FormControl>
                      <div>
                        <p className="font-medium">Utility Bill</p>
                        <p className="text-sm text-gray-500">Upload a recent utility bill (within 3 months)</p>
                      </div>
                    </FormLabel>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="phone" />
                      </FormControl>
                      <div>
                        <p className="font-medium">Phone Verification</p>
                        <p className="text-sm text-gray-500">Verify through a call to the business phone</p>
                      </div>
                    </FormLabel>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="mail" />
                      </FormControl>
                      <div>
                        <p className="font-medium">Mail Verification</p>
                        <p className="text-sm text-gray-500">Receive a postcard with a verification code</p>
                      </div>
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Separator className="my-6" />
          
          {/* Document Upload Section */}
          {(selectedMethod === 'document' || selectedMethod === 'utility') && (
            <Card className="mb-6 border-dashed">
              <CardContent className="pt-6">
                <h4 className="text-lg font-medium mb-2">
                  {selectedMethod === 'document' ? 'Upload Business Documents' : 'Upload Utility Bill'}
                </h4>
                <p className="text-sm text-gray-500 mb-4">
                  {selectedMethod === 'document' 
                    ? 'Please upload your business license, registration, or tax documents showing business ownership.'
                    : 'Please upload a recent utility bill (within 3 months) showing your business name and address.'}
                </p>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input 
                    type="file" 
                    className="hidden" 
                    id="file-upload"
                    accept="image/*, application/pdf"
                    multiple
                  />
                  <Label 
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                  >
                    Select Files
                  </Label>
                  <p className="mt-2 text-sm text-gray-500">
                    Drag and drop files here, or click to select files
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Supported formats: JPEG, PNG, PDF (max 10MB)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Phone Verification Section */}
          {selectedMethod === 'phone' && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <h4 className="text-lg font-medium mb-2">Phone Verification</h4>
                <p className="text-sm text-gray-500 mb-4">
                  We'll call the business phone number to verify ownership. Please confirm or update the phone number below.
                </p>
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter business phone number"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This should be the active phone number for your business.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}
          
          {/* Mail Verification Section */}
          {selectedMethod === 'mail' && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <h4 className="text-lg font-medium mb-2">Mail Verification</h4>
                <p className="text-sm text-gray-500 mb-4">
                  We'll mail a postcard with a verification code to your business address. Please confirm or update the address below.
                </p>
                
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter business address"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This should be the complete mailing address for your business.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isUploading || hasVerified}
              className="min-w-[150px]"
            >
              {isUploading ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Verifying...
                </>
              ) : hasVerified ? (
                'Verified ✓'
              ) : (
                'Verify Ownership'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default VerificationStep;