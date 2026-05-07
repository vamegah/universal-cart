terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "universal-cart-vpc" }
}

# Subnets (public and private)
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "universal-cart-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "universal-cart-private-${count.index}" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Internet Gateway
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "universal-cart-igw" }
}

# Route tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "universal-cart-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "universal-cart-eks"
  cluster_version = "1.28"

  vpc_id     = aws_vpc.main.id
  subnet_ids = aws_subnet.private[*].id

  eks_managed_node_groups = {
    main = {
      desired_size = 2
      min_size     = 1
      max_size     = 4
      instance_types = ["t3.medium"]
    }
  }

  tags = {
    Environment = "production"
    Project     = "universal-cart"
  }
}

# RDS (PostgreSQL)
resource "aws_db_instance" "postgres" {
  identifier     = "universal-cart-db"
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.t3.micro"
  allocated_storage = 20
  storage_encrypted = true
  db_name  = "universal_cart"
  username = var.db_username
  password = var.db_password
  parameter_group_name = "default.postgres15"
  skip_final_snapshot = true
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  publicly_accessible    = false
  backup_retention_period = 7
  tags = { Name = "universal-cart-db" }
}

resource "aws_db_subnet_group" "main" {
  name       = "universal-cart-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "universal-cart-db-subnet-group" }
}

resource "aws_security_group" "rds" {
  name        = "universal-cart-rds-sg"
  description = "Allow PostgreSQL access from EKS"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ElastiCache (Redis)
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "universal-cart-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  tags = { Name = "universal-cart-redis" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "universal-cart-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "redis" {
  name        = "universal-cart-redis-sg"
  vpc_id      = aws_vpc.main.id
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}