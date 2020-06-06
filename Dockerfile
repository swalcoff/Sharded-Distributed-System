FROM node:9-slim
WORKDIR /CSE138_Assignment3
COPY package.json /CSE138_Assignment3
RUN npm install
COPY . /CSE138_Assignment3
CMD ["npm", "start"]
