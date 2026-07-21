INSERT INTO skill_categories (name, description, icon) VALUES
  ('Programming', 'Software development, scripting, and coding skills', 'code'),
  ('Design', 'UI/UX, graphic design, and creative tools', 'palette'),
  ('Data Science', 'Data analysis, machine learning, and visualization', 'bar-chart'),
  ('Networking', 'Network administration, security, and protocols', 'wifi'),
  ('Hardware', 'Electronics, embedded systems, and PCB design', 'cpu'),
  ('Academic Tutoring', 'Math, physics, and engineering courses', 'book-open'),
  ('Writing', 'Technical writing, report editing, and documentation', 'pen-tool'),
  ('Video & Audio', 'Video editing, animation, and production', 'video'),
  ('Marketing', 'Social media, SEO, and digital marketing', 'trending-up'),
  ('Business', 'Entrepreneurship, project management, and finance', 'briefcase')
ON CONFLICT (name) DO NOTHING;
