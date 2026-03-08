export interface Launch {
  id: string;
  name: string;
  net: string; // Date string
  status: {
    name: string;
    abbrev: string;
  };
  launch_service_provider: {
    name: string;
    type: string;
  };
  pad: {
    name: string;
    latitude: string;
    longitude: string;
    location: {
      name: string;
    };
  };
  mission: {
    name: string;
    description: string;
  } | null;
}

const BASE_URL = 'https://lldev.thespacedevs.com/2.2.0/launch/upcoming/';

export const fetchUpcomingLaunches = async (): Promise<Launch[]> => {
  try {
    const response = await fetch(`${BASE_URL}?limit=500&net__lte=2028-03-08T23:59:59Z`);
    if (!response.ok) throw new Error('Failed to fetch launches');
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching launches:', error);
    return [];
  }
};
