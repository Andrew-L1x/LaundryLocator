import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { ShieldCheck, FileText, Phone, Mail, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Form validation schema
const verificationSchema = z.object({
  method: z.enum(['document', 'utility', 'phone', 'mail'], {
    required_error: 'Please select a verification method',
  }),
  documentFiles: z.array(z.any()).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email('Please enter a valid email address').min(1, 'Email is required'),
});

type VerificationFormValues = z.infer<typeof verificationSchema>;

interface VerificationStepProps {
  onComplete: (data: VerificationFormValues) => void;
  laundromat: any;
  isLoading?: boolean;
}

const VerificationStep: React.FC<VerificationStepProps> = ({ 
  onComplete, 
  laundromat, 
  isLoading = false 
}) => {
  // Initialize form
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      method: undefined,
      documentFiles: [],
      phone: laundromat?.phone || '',
      address: laundromat?.address || '',
      email: '',
    },
  });
  
  const selectedMethod = form.watch('method');
  
  // Handle form submission
  const onSubmit = (data: VerificationFormValues) => {
    // Prepare the verification data
    const verificationData = {
      method: data.method,
      files: data.method === 'document' ? data.documentFiles || [] : [],
      phone: data.method === 'phone' ? data.phone : undefined,
      address: data.method === 'mail' ? data.address : undefined,
      email: data.email, // Always include email regardless of verification method
    };
    
    onComplete(data);
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Verify Business Ownership</h2>
        <p className="text-gray-500 mt-2">
          Select a method to verify your ownership of {laundromat?.name || 'this business'}
        </p>
      </div>
      
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription className="ml-2">
          Business verification helps us ensure that only legitimate owners can manage business listings.
        </AlertDescription>
      </Alert>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Contact Email Field - Always visible and required */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Please provide your email for verification and future communications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="youremail@example.com" type="email" {...field} />
                    </FormControl>
                    <FormDescription>
                      We'll use this email to communicate about your business listing
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="text-base">Verification Method</FormLabel>
                <FormDescription>
                  Choose how you'd like to verify your ownership
                </FormDescription>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    {/* Business Document */}
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="document" className="sr-only" />
                      </FormControl>
                      <Card className={`cursor-pointer transition-all ${field.value === 'document' ? 'border-primary ring-2 ring-primary/10' : 'hover:border-gray-300'}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center text-base">
                            <FileText className="h-4 w-4 mr-2" />
                            Business Document
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription>
                            Upload business license, tax document, or utility bill with your name and business address
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </FormItem>
                    
                    {/* Utility Bill */}
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="utility" className="sr-only" />
                      </FormControl>
                      <Card className={`cursor-pointer transition-all ${field.value === 'utility' ? 'border-primary ring-2 ring-primary/10' : 'hover:border-gray-300'}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center text-base">
                            <FileText className="h-4 w-4 mr-2" />
                            Utility Bill
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription>
                            Upload a recent utility bill for the business address showing your name
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </FormItem>
                    
                    {/* Phone Verification */}
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="phone" className="sr-only" />
                      </FormControl>
                      <Card className={`cursor-pointer transition-all ${field.value === 'phone' ? 'border-primary ring-2 ring-primary/10' : 'hover:border-gray-300'}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center text-base">
                            <Phone className="h-4 w-4 mr-2" />
                            Phone Verification
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription>
                            Receive a verification code via call or text to the business phone number
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </FormItem>
                    
                    {/* Mail Verification */}
                    <FormItem>
                      <FormControl>
                        <RadioGroupItem value="mail" className="sr-only" />
                      </FormControl>
                      <Card className={`cursor-pointer transition-all ${field.value === 'mail' ? 'border-primary ring-2 ring-primary/10' : 'hover:border-gray-300'}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center text-base">
                            <Mail className="h-4 w-4 mr-2" />
                            Mail Verification
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription>
                            Receive a postcard with a verification code at the business address
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Conditional fields based on selected verification method */}
          {selectedMethod === 'document' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Upload Business Documents
                </CardTitle>
                <CardDescription>
                  Please upload one or more documents that prove your business ownership
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="documentFiles"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FileUpload
                          value={field.value || []}
                          onChange={field.onChange}
                          accept=".pdf,.jpg,.jpeg,.png"
                          multiple={true}
                          maxFiles={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Accepted formats: PDF, JPG, PNG (max 3 files, 5MB each)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}
          
          {selectedMethod === 'utility' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Upload Utility Bill
                </CardTitle>
                <CardDescription>
                  Please upload a recent utility bill from the last 90 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="documentFiles"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <FileUpload
                          value={field.value || []}
                          onChange={field.onChange}
                          accept=".pdf,.jpg,.jpeg,.png"
                          multiple={false}
                          maxFiles={1}
                        />
                      </FormControl>
                      <FormDescription>
                        Accepted formats: PDF, JPG, PNG (max 5MB)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}
          
          {selectedMethod === 'phone' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Phone className="h-4 w-4 mr-2" />
                  Phone Verification
                </CardTitle>
                <CardDescription>
                  We'll send a verification code to this phone number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="(xxx) xxx-xxxx" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>
                        Must match the phone number on record for this business
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}
          
          {selectedMethod === 'mail' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Mail Verification
                </CardTitle>
                <CardDescription>
                  We'll mail a postcard with a code to this address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, City, State, ZIP" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>
                        Must match the address on record for this business
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}
          
          <div className="flex justify-end mt-8">
            <Button 
              type="submit" 
              disabled={!selectedMethod || isLoading}
              className="w-full md:w-auto"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Continue to Next Step
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default VerificationStep;