export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PostItem {
  id: string;
  title: string;
  body: string;
  tags: string[];
  authorId: string;
  authorName: string;
  authorRole: string;
  likedBy: string[];
  comments: PostComment[];
  createdAt: string;
}
