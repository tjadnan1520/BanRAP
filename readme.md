# BanRAP

## Project Overview
BanRAP (Bangladesh Road Assessment Program) is a web-based platform for analyzing and rating the safety condition of Bangladeshi roads. The system will allow analysts to select roads using Google Maps coordinates, automatically divide the selected road into 100-meter sections, and label each section using both 2D and 3D map interfaces, including Street View integration.
Each section will store labeling information such as lane width, roadside hazard, lighting, pedestrian safety, and vehicle mix. These labels will be processed through a rating algorithm inspired by iRAP, assigning 1 to 5 stars to indicate the road’s safety level. Users will be able to view ratings, and a navigation system will be introduced where travel time is adjusted according to the star ratings of the route ,  poor-rated roads will increase estimated travel time.
Registered users can view star-rated roads, use safety-aware navigation, and submit complaints or suggestions if they find labeling inaccurate. This ensures community participation and continuous improvement of the road safety database.

## Prerequisites
- Node.js (v16 or later recommended)
- npm (comes with Node.js)
- PostgreSQL (or your preferred database, configured in `Backend/prisma/schema.prisma`)

## Backend Setup
1. Navigate to the Backend folder:
   ```bash
   cd Backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   - Create a `.env` file in the Backend folder.
   - Add your database connection string and any other required variables.
4. Run Prisma migrations:
   ```bash
   npx prisma migrate deploy
   ```
5. Start the backend server:
   ```bash
   node server.js
   ```

## Frontend Setup
1. Navigate to the Frontend folder:
   ```bash
   cd ../Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the frontend development server:
   ```bash
   npm run dev
   ```

## Accessing the Application
- The frontend will be available at [http://localhost:5173](http://localhost:5173) (default Vite port).
- The backend will run at [http://localhost:3000](http://localhost:3000) (default Express port).

## Additional Notes
- Adjust ports or environment variables as needed for your setup.
- For database configuration, edit `Backend/prisma/schema.prisma` and `.env`.
- For production, build the frontend with `npm run build` in the Frontend folder.

## License
MIT License
