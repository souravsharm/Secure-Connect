# Use the official Node.js image as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package.json package-lock.json ./

# Install the application dependencies
RUN npm ci --omit=dev

# Copy the rest of your application code
COPY . .

# Expose the port your application runs on
EXPOSE 3000

# Define the command to run your application
CMD ["node", "server.js"]
