import React from 'react';
import { Helmet } from 'react-helmet';
import LaundryDataEnricher from '@/components/LaundryDataEnricher';
import CSVImporter from '@/components/CSVImporter';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const AdminDataEnrichmentPage: React.FC = () => {
  return (
    <div className="container py-8 max-w-5xl mx-auto">
      <Helmet>
        <title>Data Management | Laundromat Near Me</title>
        <meta 
          name="description" 
          content="Admin tools for managing and enriching laundromat data" 
        />
      </Helmet>
      
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Data Management</h1>
          <p className="text-gray-600">
            Upload, manage, and enrich your laundromat data for optimal presentation and SEO.
          </p>
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="step1">
            <AccordionTrigger className="text-lg font-medium">
              Step 1: Upload CSV Data
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-4">
                <CSVImporter />
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="step2">
            <AccordionTrigger className="text-lg font-medium">
              Step 2: Enrich Your Data
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-4">
                <LaundryDataEnricher />
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="info">
            <AccordionTrigger className="text-lg font-medium">
              About Data Enrichment
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-4 space-y-4">
                <p>
                  The data enrichment process adds the following to each laundromat record:
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">SEO Tags</h3>
                    <p className="text-sm text-gray-600">
                      Automatically generates relevant tags like "24 hour", "coin laundry", 
                      "drop-off", "pickup", "delivery", "open late", and "eco-friendly" based 
                      on the business name, description, and hours.
                    </p>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">Short Summary</h3>
                    <p className="text-sm text-gray-600">
                      Creates a concise user-friendly summary (100-150 characters) 
                      highlighting key features of the laundromat for display in search 
                      results and listing cards.
                    </p>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">Default Description</h3>
                    <p className="text-sm text-gray-600">
                      Generates comprehensive descriptions (300-400 characters) for 
                      laundromats that lack a detailed description, focusing on location, 
                      services, and customer experience.
                    </p>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">Premium Score & URL Slug</h3>
                    <p className="text-sm text-gray-600">
                      Calculates a premium score (0-100) based on photos, ratings, reviews, 
                      and more. Also creates SEO-friendly URL slugs for each business.
                    </p>
                  </div>
                </div>
                
                <div className="bg-muted p-4 rounded-md text-sm">
                  <p className="font-medium mb-2">Additional Enhancements:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Normalizes inconsistent business names</li>
                    <li>Removes duplicate listings based on identical addresses</li>
                    <li>Assesses premium upsell potential for each business</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default AdminDataEnrichmentPage;