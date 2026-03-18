export interface VolunteerApplication {
  id: string;
  userId: string;
  userName: string;
  message: string;
  status: 'interested' | 'accepted' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface VolunteerPostItem {
  id: string;
  title: string;
  location: string;
  sessionTime: string;
  difficulty: string;
  notes: string;
  authorId: string;
  authorName: string;
  applicants: VolunteerApplication[];
  createdAt: string;
}
