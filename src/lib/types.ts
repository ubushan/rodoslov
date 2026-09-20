export type MemberRole = "owner" | "editor" | "viewer";
export type RelationKind = "parent" | "spouse";
export type Gender = "male" | "female" | "unknown";

export type Person = {
  id: string;
  tree_id: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  maiden_name: string | null;
  other_names: string | null;
  gender: Gender;
  birth_year: number | null;
  birth_date: string | null;
  birth_place: string | null;
  residence: string | null;
  is_living: boolean;
  death_year: number | null;
  death_date: string | null;
  bio: string | null;
  photo_path: string | null;
  pos_x: number;
  pos_y: number;
  created_at: string;
  updated_at: string;
};

export type Relationship = {
  id: string;
  tree_id: string;
  kind: RelationKind;
  from_person_id: string;
  to_person_id: string;
  note: string | null;
};

export type Attachment = {
  id: string;
  tree_id: string;
  person_id: string;
  storage_path: string;
  caption: string | null;
  kind: "photo" | "document";
  created_at: string;
};

export type Tree = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type Member = {
  tree_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

export type Invite = {
  id: string;
  tree_id: string;
  token: string;
  role: MemberRole;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked: boolean;
  created_at: string;
};
