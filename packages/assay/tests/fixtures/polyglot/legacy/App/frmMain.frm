VERSION 5.00
Begin VB.Form frmMain
   Caption         =   "Update Customers"
End
Private Sub Form_Load()
    cn.ConnectionString = "Provider=SQLOLEDB;Data Source=SQL02;" & _
        "Initial Catalog=Shop"
    Set rs = cn.Execute("SELECT c.Name, o.Total FROM Customers c JOIN Orders o ON o.CustomerId = c.Id")
End Sub
