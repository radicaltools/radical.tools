package main

func main() {
	s := grpc.NewServer()
	pb.RegisterCatalogServiceServer(s, &server{})
}
