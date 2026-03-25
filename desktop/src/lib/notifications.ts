export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: 'info' | 'warning' | 'success';
};

export const notifications: NotificationItem[] = [
  {
    id: 'ntf-1',
    title: 'Rent received',
    description: 'Unit A1 rent received for March.',
    time: '10 minutes ago',
    tone: 'success'
  },
  {
    id: 'ntf-2',
    title: 'Utility bill pending',
    description: 'Electricity bill for Unit A2 is due.',
    time: '2 hours ago',
    tone: 'warning'
  },
  {
    id: 'ntf-3',
    title: 'Maintenance logged',
    description: 'Plumbing repair recorded for Building A.',
    time: 'Yesterday',
    tone: 'info'
  },
  {
    id: 'ntf-4',
    title: 'Follow-up needed',
    description: 'Rent reminder sent for Unit 101.',
    time: '2 days ago',
    tone: 'warning'
  },
  {
    id: 'ntf-5',
    title: 'New tenant added',
    description: 'Tenant added to Unit B2.',
    time: '3 days ago',
    tone: 'success'
  },
  {
    id: 'ntf-6',
    title: 'Pending rent',
    description: 'Unit A3 rent still unpaid.',
    time: 'Last week',
    tone: 'warning'
  }
];
