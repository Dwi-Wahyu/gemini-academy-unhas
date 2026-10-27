CREATE TABLE IF NOT EXISTS users(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(150) NOT NULL,email VARCHAR(255) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,is_admin BOOLEAN NOT NULL DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS schedules(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,event_date DATE NOT NULL,location VARCHAR(255) NOT NULL,description TEXT,exempt_student_quota BOOLEAN NOT NULL DEFAULT 0,is_active BOOLEAN NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS academy_sessions(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,schedule_id BIGINT UNSIGNED NULL,name VARCHAR(255) NOT NULL,starts_at VARCHAR(5) NOT NULL,ends_at VARCHAR(5) NOT NULL,allowed_professions VARCHAR(255) NULL DEFAULT 'ALL',exempt_student_quota BOOLEAN NOT NULL DEFAULT 0,capacity INT UNSIGNED NOT NULL DEFAULT 230,reserved INT UNSIGNED NOT NULL DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS participants(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,registration_code CHAR(36) NOT NULL UNIQUE,name VARCHAR(150) NOT NULL,nip VARCHAR(30) NOT NULL UNIQUE,unit VARCHAR(200) NOT NULL,phone VARCHAR(20) NOT NULL,email VARCHAR(200),profession VARCHAR(20) NOT NULL,employment_status VARCHAR(20) NOT NULL,letter_file VARCHAR(255),academy_session_id BIGINT UNSIGNED NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,FOREIGN KEY(academy_session_id) REFERENCES academy_sessions(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS admin_sessions(token_hash CHAR(64) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at DATETIME NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS login_attempts(email_hash CHAR(64) PRIMARY KEY,attempts INT NOT NULL DEFAULT 0,reset_at DATETIME NOT NULL) ENGINE=InnoDB;
INSERT INTO schedules(id,title,event_date,location) VALUES
(1,'Program Pelatihan Gemini Academy untuk Dosen dan Pimpinan Universitas Hasanuddin','2026-10-30','Arsyad Rasyid Lecture Theather'),
(2,'Program Pelatihan Gemini Academy untuk Tendik dan Mahasiswa Universitas Hasanuddin','2026-10-31','Arsyad Rasyid Lecture Theather')
ON DUPLICATE KEY UPDATE id=id;
INSERT INTO academy_sessions(id,schedule_id,name,starts_at,ends_at,allowed_professions) VALUES
(1,1,'Sesi I (Pagi)','08:30','11:30','Dosen,Pimpinan'),
(2,1,'Sesi II (Siang)','13:30','16:30','Dosen,Pimpinan'),
(3,2,'Sesi I (Pagi)','08:30','11:30','Tendik,Mahasiswa'),
(4,2,'Sesi II (Siang)','13:30','16:30','Tendik,Mahasiswa')
ON DUPLICATE KEY UPDATE id=id;
CREATE TABLE IF NOT EXISTS work_units(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(200) NOT NULL UNIQUE,max_quota INT UNSIGNED NOT NULL DEFAULT 20,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;
INSERT INTO work_units(name,max_quota) VALUES
('Fakultas Ekonomi dan Bisnis',20),
('Fakultas Hukum',20),
('Fakultas Kedokteran',20),
('Fakultas Teknik',20),
('Fakultas Ilmu Sosial dan Ilmu Politik',20),
('Fakultas Ilmu Budaya',20),
('Fakultas Pertanian',20),
('Fakultas Matematika dan Ilmu Pengetahuan Alam',20),
('Fakultas Peternakan',20),
('Fakultas Kedokteran Gigi',20),
('Fakultas Kesehatan Masyarakat',20),
('Fakultas Ilmu Kelautan dan Perikanan',20),
('Fakultas Kehutanan',20),
('Fakultas Farmasi',20),
('Fakultas Keperawatan',20),
('Fakultas Vokasi',20),
('Sekolah Pascasarjana',20),
('Fakultas Teknologi Pertanian',20)
ON DUPLICATE KEY UPDATE name=name;
