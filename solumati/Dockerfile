ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Setup Environment
ENV LANG C.UTF-8
ENV PIP_ROOT_USER_ACTION=ignore
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install System Requirements
RUN \
    apk add --no-cache \
    nodejs \
    npm \
    postgresql \
    postgresql-dev \
    nginx \
    gcc \
    musl-dev \
    libffi-dev \
    git \
    python3 \
    py3-pip

# --- SOURCE CODE FETCH STAGE ---
# Clone the repository dynamically
WORKDIR /tmp
RUN git clone https://github.com/FaserF/Solumati.git src

# Fix syntax error in upstream Questionnaire.jsx (duplicate return statement)
RUN sed -i '81d' src/frontend/src/components/Questionnaire.jsx

# --- FRONTEND BUILD STAGE ---
WORKDIR /tmp/frontend_build
# Copy package files from the cloned source
RUN cp /tmp/src/frontend/package.json . && \
    cp /tmp/src/frontend/package-lock.json* . || true

RUN npm install

# Copy source code from cloned directory
RUN cp -r /tmp/src/frontend/. .

RUN sed -i 's|http://localhost:7777|/api|g' src/config.js

RUN npm run build

# --- BACKEND SETUP ---
WORKDIR /app/backend
# Copy backend requirements from cloned source
RUN cp /tmp/src/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code from cloned source
RUN cp -r /tmp/src/backend/. .

# Move built frontend to a location Nginx can serve
RUN mkdir -p /app/frontend
RUN cp -r /tmp/frontend_build/dist/* /app/frontend/

# Setup Nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy Run Script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]