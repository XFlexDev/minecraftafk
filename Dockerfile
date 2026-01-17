FROM node:20-slim
WORKDIR /app
RUN apt-get update -qq && apt-get install --no-install-recommends -y \
  build-essential node-gyp pkg-config python-is-python3 cmake \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm","run","start"]
