-- Dashboard › Noticias: cada persona puede quitar una noticia de su inicio (con la X).
CREATE TABLE news_dismissed (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline_id INTEGER NOT NULL REFERENCES meeting_headlines(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, headline_id)
);
