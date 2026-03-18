import type { PostComment } from '../../../shared/types/post';
import { formatDate } from '../../../shared/utils/formatDate';

interface CommentListProps {
  comments: PostComment[];
}

export default function CommentList({ comments }: CommentListProps) {
  return (
    <div className="stack">
      {comments.map((comment) => (
        <article key={comment.id} className="list-item">
          <strong>{comment.authorName}</strong>
          <p>{comment.body}</p>
          <span className="subtle-text">{formatDate(comment.createdAt)}</span>
        </article>
      ))}
    </div>
  );
}
