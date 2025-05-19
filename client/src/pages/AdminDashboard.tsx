import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Helmet } from 'react-helmet';
import { apiRequest } from '@/lib/queryClient';

interface Notification {
  id: number;
  type: string;
  status: string;
  createdAt: string;
  contact: {
    email: string;
    phone: string;
  };
  laundromat: {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    slug: string;
  };
  user: {
    id: number;
    username: string;
    email: string;
  };
  formData: any;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/notifications'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await apiRequest('PATCH', `/api/admin/notifications/${id}`, { status });
      toast({
        title: 'Status updated',
        description: `Notification marked as ${status}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update notification status',
        variant: 'destructive',
      });
    }
  };
  
  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter((notification: Notification) => {
    if (activeTab === 'all') return true;
    return notification.status === activeTab;
  });
  
  // Count notifications by status
  const counts = {
    all: notifications.length,
    unread: notifications.filter((n: Notification) => n.status === 'unread').length,
    read: notifications.filter((n: Notification) => n.status === 'read').length,
    contacted: notifications.filter((n: Notification) => n.status === 'contacted').length,
  };
  
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <Helmet>
        <title>Admin Dashboard | Laundry Locator</title>
        <meta name="description" content="Admin dashboard for LaundryLocator business claims" />
      </Helmet>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button onClick={() => refetch()}>Refresh</Button>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-md mb-6">
          <TabsTrigger value="all">
            All <Badge className="ml-2">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread <Badge className="ml-2 bg-red-500">{counts.unread}</Badge>
          </TabsTrigger>
          <TabsTrigger value="read">
            Read <Badge className="ml-2">{counts.read}</Badge>
          </TabsTrigger>
          <TabsTrigger value="contacted">
            Contacted <Badge className="ml-2 bg-green-500">{counts.contacted}</Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="flex justify-center my-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-lg text-gray-500">No notifications found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredNotifications.map((notification: Notification) => (
                <Card key={notification.id} className={notification.status === 'unread' ? 'border-2 border-red-400' : ''}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{notification.laundromat.name}</CardTitle>
                        <CardDescription>
                          {notification.laundromat.address}, {notification.laundromat.city}, {notification.laundromat.state} {notification.laundromat.zip}
                        </CardDescription>
                      </div>
                      <Badge className={
                        notification.status === 'unread' ? 'bg-red-500' : 
                        notification.status === 'contacted' ? 'bg-green-500' : 'bg-blue-500'
                      }>
                        {notification.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium">Contact Information</h3>
                        <p>Email: <a href={`mailto:${notification.contact.email}`} className="text-blue-600">{notification.contact.email}</a></p>
                        {notification.contact.phone && (
                          <p>Phone: <a href={`tel:${notification.contact.phone}`} className="text-blue-600">{notification.contact.phone}</a></p>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="font-medium">Form Details</h3>
                        <p>Submitted: {new Date(notification.createdAt).toLocaleString()}</p>
                        <p>Selected Plan: {notification.formData?.selectedPlan || 'basic'}</p>
                        <p>Verification Method: {notification.formData?.verificationMethod || 'Not specified'}</p>
                        {notification.formData?.email && notification.formData.email !== notification.contact.email && (
                          <p>Owner Email: <a href={`mailto:${notification.formData.email}`} className="text-blue-600">{notification.formData.email}</a> <Badge className="ml-2 bg-green-500">New</Badge></p>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="font-medium">User Information</h3>
                        <p>Username: {notification.user.username}</p>
                        <p>User ID: {notification.user.id}</p>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="flex justify-between">
                    <div className="flex gap-2">
                      {notification.status !== 'read' && (
                        <Button variant="outline" onClick={() => handleUpdateStatus(notification.id, 'read')}>
                          Mark as Read
                        </Button>
                      )}
                      {notification.status !== 'contacted' && (
                        <Button onClick={() => handleUpdateStatus(notification.id, 'contacted')}>
                          Mark as Contacted
                        </Button>
                      )}
                      {notification.status !== 'unread' && (
                        <Button variant="outline" onClick={() => handleUpdateStatus(notification.id, 'unread')}>
                          Mark as Unread
                        </Button>
                      )}
                    </div>
                    
                    <a href={`/laundromat/${notification.laundromat.slug}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline">View Listing</Button>
                    </a>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}