# LaundryLocator - Find Laundromats Near You

A comprehensive laundromat directory web application that simplifies finding and using local laundry services through advanced geolocation search and interactive mapping.

## Features

- **Search laundromats by location**: Find laundromats near you using ZIP code, city, or geolocation
- **Advanced filtering**: Filter by services, ratings, hours, and more
- **Detailed listings**: View comprehensive information about each laundromat
- **User reviews and ratings**: Read and write reviews to help others make informed decisions
- **Business owner tools**: Claim and manage your laundromat listings
- **Location-based pages**: Browse laundromats by city and state
- **Laundry tips**: Helpful articles and guides for laundry care
- **Responsive design**: Works great on mobile, tablet, and desktop devices

## Premium Listing System

The application includes a premium listing system that provides additional visibility and features for business owners.

### Subscription Tiers

- **Basic (Free)**
  - Standard listing in search results
  - Basic business information
  - Contact details
  - Standard position in search results

- **Premium**
  - Enhanced visibility in search results
  - Special badge to highlight listing
  - Custom promotional text
  - Priority placement in search results
  - Upload up to 10 photos
  - Custom amenities list
  - Business hour highlights

- **Featured**
  - All Premium features
  - Featured placement in homepage carousel
  - Top position in search results
  - Special offers and promotions display
  - Upload up to 20 photos
  - Analytics dashboard
  - Premium badge with gold accent
  - Preferred customer service

### Business Owner Dashboard

Business owners can:
- View and manage their listings
- Upgrade to Premium or Featured status
- Monitor subscription status
- Update business information
- Track listing performance
- Manage promotional content
- View and respond to customer reviews

### Technology Stack

- **Frontend**: React.js with TypeScript, ShadCN UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Maps Integration**: Google Maps API for location-based features
- **State Management**: React Query for server state, React Context for UI state
- **Authentication**: JWT-based authentication with secure cookie sessions
- **Payment Processing**: Stripe integration for subscription management
- **Styling**: Tailwind CSS for responsive and maintainable styles

## Getting Started

### Prerequisites

- Node.js v18 or higher
- PostgreSQL database
- Google Maps API key (for mapping features)
- Stripe API keys (for payment processing)

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/laundrylocator.git
cd laundrylocator
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL=your_postgresql_connection_string
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

4. Start the development server
```bash
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.