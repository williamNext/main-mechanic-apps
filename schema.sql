-- 0. Drop existing tables if re-running
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS timeslots CASCADE;
DROP TABLE IF EXISTS mechanics CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Create tables

CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'mechanic', 'client')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE mechanics (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  specialty TEXT NOT NULL,
  credentials TEXT NOT NULL,
  rating FLOAT DEFAULT 5.0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE timeslots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mechanic_id UUID REFERENCES mechanics(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mechanic_id UUID REFERENCES mechanics(id) ON DELETE CASCADE NOT NULL,
  timeslot_id UUID REFERENCES timeslots(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending',
  vehicle_info TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeslots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 3. Basic RLS Policies (Simplified for MVP)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Mechanics are viewable by everyone" ON mechanics FOR SELECT USING (true);
CREATE POLICY "Mechanics can update own details" ON mechanics FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Mechanics can insert own details" ON mechanics FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "TimeSlots are viewable by everyone" ON timeslots FOR SELECT USING (true);
CREATE POLICY "Mechanics can manage own timeslots" ON timeslots FOR ALL USING (auth.uid() = mechanic_id);

CREATE POLICY "Clients can view own appointments" ON appointments FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Mechanics can view assigned appointments" ON appointments FOR SELECT USING (auth.uid() = mechanic_id);
CREATE POLICY "Admins can view all" ON appointments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Clients can book appointments" ON appointments FOR INSERT WITH CHECK (auth.uid() = client_id);
