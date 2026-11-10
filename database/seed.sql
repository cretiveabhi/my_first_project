-- Seed script: safe to run once on a fresh project. Re-running adds another demo set.
insert into public.farmers (farmer_code,name,mobile,village,district,preferred_language,latitude,longitude) values
('KS-1001','Ramesh Patel','9876501001','Rau','Indore','Hindi',22.6397,75.8067),
('KS-1002','Suresh Verma','9876501002','Mhow','Indore','Hindi',22.5520,75.7560),
('KS-1003','Kamla Bai','9876501003','Sanwer','Indore','Hindi',22.9760,75.8270),
('KS-1004','Mohan Solanki','9876501004','Depalpur','Indore','Malvi',22.8500,75.5450),
('KS-1005','Geeta Yadav','9876501005','Hatod','Indore','Hindi',22.8400,75.9000),
('KS-1006','Arjun Chouhan','9876501006','Betma','Indore','Hindi',22.6900,75.6100),
('KS-1007','Sunita Patel','9876501007','Gautampura','Indore','Hindi',22.9850,75.5200),
('KS-1008','Dinesh Rathore','9876501008','Khudel','Indore','Hindi',22.6400,75.9200),
('KS-1009','Pooja Kushwaha','9876501009','Pithampur Road','Indore','Hindi',22.6200,75.7000),
('KS-1010','Mahesh Pawar','9876501010','Kanadia','Indore','Hindi',22.6900,75.8900),
('KS-1011','Rekha Bai','9876501011','Sanwer Road','Indore','Hindi',22.8000,75.9000),
('KS-1012','Vijay Meena','9876501012','Palda','Indore','Hindi',22.6800,75.8400),
('KS-1013','Nirmala Joshi','9876501013','Limbodi','Indore','Hindi',22.6500,75.8700),
('KS-1014','Rajesh Dangi','9876501014','Simrol','Indore','Hindi',22.5200,75.8100),
('KS-1015','Asha Solanki','9876501015','Bicholi Mardana','Indore','Hindi',22.6900,75.8600),
('KS-1016','Prakash Choudhary','9876501016','Kshipra','Indore','Hindi',22.8200,75.7400),
('KS-1017','Meena Bai','9876501017','Ralamandal','Indore','Hindi',22.6500,75.9000),
('KS-1018','Deepak Sharma','9876501018','Manglia','Indore','Hindi',22.7800,75.8300),
('KS-1019','Savita Rathore','9876501019','Tillore Khurd','Indore','Hindi',22.7100,75.9500),
('KS-1020','Gopal Patel','9876501020','Kampel','Indore','Hindi',22.7600,75.9600);

insert into public.centres (name,address,village,latitude,longitude,capacity_quintals,available_quintals) values
('Indore Krishi Upaj Mandi','Laxmibai Nagar, Indore, Madhya Pradesh','Indore',22.7270,75.8650,1200,760),
('Sanwer Procurement Centre','Sanwer, Indore district, Madhya Pradesh','Sanwer',22.9760,75.8270,800,520),
('Mhow Procurement Centre','Mhow, Indore district, Madhya Pradesh','Mhow',22.5520,75.7560,650,390),
('Depalpur Procurement Centre','Depalpur, Indore district, Madhya Pradesh','Depalpur',22.8500,75.5450,700,470),
('Rau Procurement Centre','Rau, Indore district, Madhya Pradesh','Rau',22.6397,75.8067,550,310),
('Hatod Procurement Centre','Hatod, Indore district, Madhya Pradesh','Hatod',22.8400,75.9000,500,340),
('Gautampura Procurement Centre','Gautampura, Indore district, Madhya Pradesh','Gautampura',22.9850,75.5200,600,410),
('Pithampur Procurement Centre','Pithampur, near Indore, Madhya Pradesh','Pithampur',22.6200,75.7000,750,480);

insert into public.bookings (farmer_id,crop,booking_date,quantity_quintals,status)
select id,'Wheat',current_date + 2,60,'Booking confirmed' from public.farmers where farmer_code='KS-1001';
insert into public.bookings (farmer_id,crop,booking_date,quantity_quintals,status)
select id,'Soybean',current_date + 3,80,'Waiting for procurement' from public.farmers where farmer_code='KS-1002';
insert into public.bookings (farmer_id,crop,booking_date,quantity_quintals,status)
select id,'Gram',current_date + 4,45,'Booking confirmed' from public.farmers where farmer_code='KS-1003';
insert into public.bookings (farmer_id,crop,booking_date,quantity_quintals,status)
select id,'Wheat',current_date + 5,100,'Crop weighing' from public.farmers where farmer_code='KS-1004';

-- Split allocations for seeded bookings. Uses farmer code to find booking rows.
insert into public.split_allocations (booking_id,centre_id,quantity_quintals)
select b.id,c.id,35 from public.bookings b join public.farmers f on f.id=b.farmer_id cross join public.centres c
where f.farmer_code='KS-1001' and c.name='Indore Krishi Upaj Mandi';
insert into public.split_allocations (booking_id,centre_id,quantity_quintals)
select b.id,c.id,25 from public.bookings b join public.farmers f on f.id=b.farmer_id cross join public.centres c
where f.farmer_code='KS-1001' and c.name='Rau Procurement Centre';
insert into public.split_allocations (booking_id,centre_id,quantity_quintals)
select b.id,c.id,b.quantity_quintals from public.bookings b join public.farmers f on f.id=b.farmer_id cross join public.centres c
where f.farmer_code='KS-1002' and c.name='Sanwer Procurement Centre';
insert into public.split_allocations (booking_id,centre_id,quantity_quintals)
select b.id,c.id,b.quantity_quintals from public.bookings b join public.farmers f on f.id=b.farmer_id cross join public.centres c
where f.farmer_code='KS-1003' and c.name='Mhow Procurement Centre';
insert into public.split_allocations (booking_id,centre_id,quantity_quintals)
select b.id,c.id,b.quantity_quintals from public.bookings b join public.farmers f on f.id=b.farmer_id cross join public.centres c
where f.farmer_code='KS-1004' and c.name='Depalpur Procurement Centre';

insert into public.weather_records (centre_id,forecast_for,condition,temperature_c,humidity_percent,rainfall_probability,rainfall_mm,severity)
select id,current_date + interval '1 day','Partly cloudy',29,62,20,1,'low' from public.centres where name='Indore Krishi Upaj Mandi';
insert into public.weather_records (centre_id,forecast_for,condition,temperature_c,humidity_percent,rainfall_probability,rainfall_mm,severity)
select id,current_date + interval '1 day','Light rain',25,78,55,8,'medium' from public.centres where name='Sanwer Procurement Centre';
insert into public.weather_records (centre_id,forecast_for,condition,temperature_c,humidity_percent,rainfall_probability,rainfall_mm,severity)
select id,current_date + interval '1 day','Cloudy',27,68,30,2,'low' from public.centres where name='Mhow Procurement Centre';
insert into public.weather_records (centre_id,forecast_for,condition,temperature_c,humidity_percent,rainfall_probability,rainfall_mm,severity)
select id,current_date + interval '1 day','Partly cloudy',28,60,15,0,'low' from public.centres where name='Depalpur Procurement Centre';

insert into public.notifications (farmer_id,booking_id,type,title,message,severity)
select f.id,b.id,'booking','Your booking is confirmed','Your wheat procurement booking for 60 quintals has been confirmed.','normal'
from public.farmers f join public.bookings b on b.farmer_id=f.id where f.farmer_code='KS-1001';
insert into public.tracking_events (booking_id,status,note)
select id,'Booking confirmed','Sample booking seeded for evaluator demonstration.' from public.bookings;
